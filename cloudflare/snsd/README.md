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
