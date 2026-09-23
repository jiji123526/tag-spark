import { neon } from "@neondatabase/serverless";
import {
  LEGACY_SIMILARITY_WEIGHT,
  LEGACY_TAG_CLUSTERS,
} from "./legacy-tag-clusters.mjs";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error("DATABASE_URL is required");

const sql = neon(connectionString);
const tags = await sql`SELECT id, name, aliases FROM tags ORDER BY id`;
const nameToId = new Map();

for (const tag of tags) {
  nameToId.set(tag.name, tag.id);
  for (const alias of tag.aliases ?? []) nameToId.set(alias, tag.id);
}

const missingNames = new Set();
const pairs = new Map();

for (const cluster of LEGACY_TAG_CLUSTERS) {
  const ids = cluster
    .map((name) => {
      const id = nameToId.get(name);
      if (!Number.isInteger(id)) missingNames.add(name);
      return id;
    })
    .filter(Number.isInteger)
    .sort((a, b) => a - b);

  for (let i = 0; i < ids.length; i++) {
    for (let j = i + 1; j < ids.length; j++) {
      if (ids[i] === ids[j]) continue;
      pairs.set(`${ids[i]}:${ids[j]}`, [ids[i], ids[j]]);
    }
  }
}

if (missingNames.size > 0) {
  console.warn(
    `Skipping legacy cluster names not found in tags: ${[...missingNames].join(", ")}`,
  );
}

for (const [tagAId, tagBId] of pairs.values()) {
  await sql`
    INSERT INTO tag_similarity (tag_a_id, tag_b_id, weight, source)
    VALUES (${tagAId}, ${tagBId}, ${LEGACY_SIMILARITY_WEIGHT}, 'curated')
    ON CONFLICT (tag_a_id, tag_b_id, source)
    DO UPDATE SET weight = EXCLUDED.weight, updated_at = now()
  `;
}

const [{ count }] = await sql`
  SELECT COUNT(*)::int AS count
  FROM tag_similarity
  WHERE source = 'curated'
`;

if (count !== pairs.size) {
  throw new Error(`Parity check failed: expected ${pairs.size} curated edges, found ${count}`);
}

console.log(
  `Seeded ${count} curated tag-similarity edges at weight ${LEGACY_SIMILARITY_WEIGHT}.`,
);
