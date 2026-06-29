# Tag Spark

태그 기반 작품 추천 웹앱. 사용자가 선호하는 태그를 선택하면 유사한 작품을 추천해줍니다.

## Tech Stack

- **Frontend:** React 18, TypeScript, Vite
- **Styling:** Tailwind CSS + CSS Modules
- **UI Components:** shadcn/ui (Radix primitives)
- **Database:** Neon (serverless Postgres)
- **Deployment:** Vercel (static frontend + serverless API)

## Getting Started

```bash
# Install dependencies
npm install

# Set up environment
cp .env.example .env
# Add your Neon DATABASE_URL to .env

# Start dev server
npm run dev
```

The app runs at `http://localhost:8080`.

## Project Structure

```
tag-spark/
├── api/                        # Vercel serverless functions
│   ├── reco-data.js            # Returns works, tags, work_tags
│   ├── scrape.js               # Cron: scrapes work metadata
│   ├── tags.js                 # Returns all tags
│   └── works.js                # CRUD for works
├── src/
│   ├── assets/
│   │   ├── icons/              # UI icons (per-page subfolders)
│   │   ├── images/             # Raster images
│   │   └── illustrations/      # Large decorative SVGs
│   ├── components/
│   │   ├── ui/                 # shadcn/ui primitives
│   │   ├── AddWorkCompose.tsx  # Add work form
│   │   ├── ContextMenu.tsx     # Long-press context menu
│   │   ├── Header.tsx          # Page header
│   │   ├── SortMenu.tsx        # Sort options menu
│   │   └── WorkCard.tsx        # Work display card
│   ├── hooks/
│   │   └── use-toast.ts
│   ├── lib/
│   │   ├── reco.ts             # Recommendation algorithm
│   │   ├── types.ts            # Shared TypeScript types
│   │   └── utils.ts            # Utility functions
│   ├── pages/
│   │   ├── Index.tsx           # Tag selection (mobile)
│   │   ├── List.tsx            # Work list with filters
│   │   ├── Loading.tsx         # Loading screen
│   │   ├── MobileLanding.tsx   # Mobile landing/lock screen
│   │   ├── NotFound.tsx        # 404
│   │   ├── Onboarding.tsx      # First-time onboarding
│   │   ├── Recommend.tsx       # Recommendation results
│   │   └── WebLanding.tsx      # Desktop landing
│   ├── styles/
│   │   └── global.css          # Global styles & fonts
│   ├── App.tsx                 # Root component (providers)
│   ├── routes.tsx              # Route definitions
│   └── main.tsx                # Entry point
├── .env                        # DATABASE_URL (not committed)
├── vercel.json                 # Vercel config (cron + rewrites)
├── vite.config.ts              # Vite config + local API middleware
└── tailwind.config.ts
```

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start dev server with HMR |
| `npm run build` | Production build |
| `npm run preview` | Preview production build |
| `npm run lint` | Run ESLint |

## Environment Variables

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | Neon Postgres connection string |

## How It Works

1. User selects tags that describe their preferences
2. The recommendation engine (`src/lib/reco.ts`) scores works based on tag overlap, category weights, and alias matching
3. Results are ranked and displayed with relevant metadata

## Deployment

Push to main → Vercel auto-deploys. The `api/` directory becomes serverless functions, and `vercel.json` configures a daily scrape cron at 3 AM UTC.
