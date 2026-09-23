const DECISIONS = new Set(["win", "tie", "skip"]);

export async function handleTagComparisons(sql, { method, body }) {
  if (method === "GET") {
    const [axes, axisTags, comparisons] = await Promise.all([
      sql`
        SELECT id, key, label, prompt, high_label
        FROM embedding_axis
        ORDER BY id
      `,
      sql`
        SELECT eat.axis_id, t.id, t.name, t.category
        FROM embedding_axis_tag eat
        JOIN tags t ON t.id = eat.tag_id
        ORDER BY eat.axis_id, t.id
      `,
      sql`
        SELECT id, axis_id, tag_a_id, tag_b_id, winner_tag_id, decision, updated_at
        FROM tag_axis_comparison
        WHERE annotator_key = 'owner'
        ORDER BY updated_at, id
      `,
    ]);

    return { status: 200, body: { axes, axisTags, comparisons } };
  }

  if (method === "POST") {
    const axisKey = String(body?.axisKey ?? "");
    const rawA = Number(body?.tagAId);
    const rawB = Number(body?.tagBId);
    const decision = String(body?.decision ?? "");
    const requestedWinner = body?.winnerTagId == null ? null : Number(body.winnerTagId);

    if (!axisKey || !Number.isInteger(rawA) || !Number.isInteger(rawB) || rawA === rawB) {
      return { status: 400, body: { error: "유효한 축과 서로 다른 태그가 필요합니다." } };
    }
    if (!DECISIONS.has(decision)) {
      return { status: 400, body: { error: "유효한 비교 결과가 아닙니다." } };
    }

    const tagAId = Math.min(rawA, rawB);
    const tagBId = Math.max(rawA, rawB);
    const winnerTagId = decision === "win" ? requestedWinner : null;
    if (decision === "win" && winnerTagId !== tagAId && winnerTagId !== tagBId) {
      return { status: 400, body: { error: "승자는 비교 대상 태그 중 하나여야 합니다." } };
    }

    const [axis] = await sql`
      SELECT id FROM embedding_axis WHERE key = ${axisKey} LIMIT 1
    `;
    if (!axis) return { status: 404, body: { error: "비교 축을 찾을 수 없습니다." } };

    const configuredTags = await sql`
      SELECT tag_id
      FROM embedding_axis_tag
      WHERE axis_id = ${axis.id} AND tag_id IN (${tagAId}, ${tagBId})
    `;
    if (configuredTags.length !== 2) {
      return { status: 400, body: { error: "이 축에 포함되지 않은 태그입니다." } };
    }

    const [comparison] = await sql`
      INSERT INTO tag_axis_comparison (
        axis_id, tag_a_id, tag_b_id, winner_tag_id, decision, annotator_key
      )
      VALUES (${axis.id}, ${tagAId}, ${tagBId}, ${winnerTagId}, ${decision}, 'owner')
      ON CONFLICT (axis_id, tag_a_id, tag_b_id, annotator_key)
      DO UPDATE SET
        winner_tag_id = EXCLUDED.winner_tag_id,
        decision = EXCLUDED.decision,
        updated_at = now()
      RETURNING id, axis_id, tag_a_id, tag_b_id, winner_tag_id, decision, updated_at
    `;

    return { status: 200, body: comparison };
  }

  return { status: 405, body: { error: "Method not allowed" } };
}
