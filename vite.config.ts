import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";
import { neon } from "@neondatabase/serverless";
import { handleTagComparisons } from "./server/tag-comparisons.js";

function readJsonBody(req): Promise<unknown> {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => { body += chunk; });
    req.on("end", () => {
      try { resolve(body ? JSON.parse(body) : {}); }
      catch (error) { reject(error); }
    });
    req.on("error", reject);
  });
}

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');

  return {
    server: {
      host: "::",
      port: 8080,
      allowedHosts: true,
    },
    plugins: [
      react(),
      mode === 'development' && componentTagger(),
      {
        name: 'local-api',
        configureServer(server) {
          const sql = neon(env.DATABASE_URL);

          server.middlewares.use('/api/reco-data', async (req, res) => {
            try {
              const [works, tags, workTags, tagSimilarity] = await Promise.all([
                sql`SELECT id, title, author, source_url, aliases, author_aliases, views, likes, comments, posted_at FROM works ORDER BY id`,
                sql`SELECT id, name, category, aliases FROM tags ORDER BY id`,
                sql`SELECT work_id, tag_id, weight FROM work_tags`,
                sql`
                  SELECT tag_a_id, tag_b_id, weight, source
                  FROM tag_similarity
                  WHERE source = 'curated'
                  ORDER BY tag_a_id, tag_b_id
                `,
              ]);
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ works, tags, workTags, tagSimilarity }));
            } catch (e) { res.statusCode = 500; res.end('{}'); }
          });

          server.middlewares.use('/api/tags', async (req, res) => {
            try {
              const tags = await sql`SELECT id, name, category, aliases FROM tags ORDER BY id`;
              res.setHeader('Content-Type', 'application/json');
              res.setHeader('Cache-Control', 'public, max-age=60');
              res.end(JSON.stringify(tags));
            } catch (e) { res.statusCode = 500; res.end('[]'); }
          });

          server.middlewares.use('/api/tag-comparisons', async (req, res) => {
            try {
              const body = req.method === 'POST' ? await readJsonBody(req) : {};
              const result = await handleTagComparisons(sql, { method: req.method, body });
              res.statusCode = result.status;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify(result.body));
            } catch (error) {
              console.error('tag-comparisons failed', error);
              res.statusCode = 500;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ error: '비교 데이터를 처리하지 못했습니다.' }));
            }
          });

          server.middlewares.use('/api/works', async (req, res) => {
            if (req.method === 'POST') {
              let body = '';
              req.on('data', c => body += c);
              req.on('end', async () => {
                try {
                  const { title, author, source_url, tags } = JSON.parse(body);
                  const [dup] = await sql`SELECT id, title, author FROM works WHERE LOWER(source_url) = LOWER(${source_url.trim()}) LIMIT 1`;
                  if (dup) { res.statusCode = 409; res.end(JSON.stringify({ error: `이미 등록된 작품입니다: ${dup.title} - ${dup.author}` })); return; }
                  const [work] = await sql`INSERT INTO works (title, author, source_url) VALUES (${title}, ${author}, ${source_url}) RETURNING *`;
                  if (tags?.length) { for (const t of tags) { await sql`INSERT INTO work_tags (work_id, tag_id, weight) VALUES (${work.id}, ${t}, 1) ON CONFLICT DO NOTHING`; } }
                  res.statusCode = 201;
                  res.setHeader('Content-Type', 'application/json');
                  res.end(JSON.stringify(work));
                } catch (e) { res.statusCode = 500; res.end('{}'); }
              });
            } else {
              res.statusCode = 405; res.end('');
            }
          });
        }
      },
    ].filter(Boolean),
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
    },
  };
});
