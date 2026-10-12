# SNSD Cloudflare backend

This Worker owns only the `/snsd` feature data.

- D1: work metadata, likes, comments
- R2: uploaded TXT files
- Existing TagSpark Neon data is untouched.

## Setup

```bash
npx wrangler login
npx wrangler d1 create tagspark-snsd
npx wrangler r2 bucket create tagspark-snsd-files
```

Copy the returned D1 database ID into `wrangler.jsonc`, then run:

```bash
npx wrangler d1 migrations apply tagspark-snsd --remote --config cloudflare/snsd/wrangler.jsonc
npx wrangler deploy --config cloudflare/snsd/wrangler.jsonc
```

For local development:

```bash
npx wrangler d1 migrations apply tagspark-snsd --local --config cloudflare/snsd/wrangler.jsonc
npx wrangler dev --config cloudflare/snsd/wrangler.jsonc
```

Set `ALLOWED_ORIGIN` in `wrangler.jsonc` to the deployed TagSpark origin. Multiple origins may be comma-separated. Set the frontend's `VITE_SNSD_API_URL` to the deployed Worker URL.

The Worker uses the root project's `iconv-lite` dependency for CP949 and UTF-16 TXT uploads. The Wrangler alias in `wrangler.jsonc` points to that installed dependency, so run `npm install` from the repository root before deploying.

## Recalculate existing chapter counts

새 파서를 기존 작품에도 적용하려면 유지보수 토큰을 한 번 설정한 뒤 백필 API를 호출합니다.

```bash
npx wrangler secret put SNSD_MAINTENANCE_TOKEN --config cloudflare/snsd/wrangler.jsonc
```

전체 작품을 다시 계산합니다.

```bash
curl -X POST \
  -H "Authorization: Bearer YOUR_MAINTENANCE_TOKEN" \
  "https://YOUR_WORKER_URL/api/works/recalculate-chapters"
```

특정 작품만 다시 계산하려면 `workId`를 추가합니다.

```bash
curl -X POST \
  -H "Authorization: Bearer YOUR_MAINTENANCE_TOKEN" \
  "https://YOUR_WORKER_URL/api/works/recalculate-chapters?workId=123"
```

이 작업은 R2의 원문을 다시 읽고 D1의 `chapter_count`만 갱신합니다. 파일 내용이나 작품 정보는 변경하지 않습니다.
