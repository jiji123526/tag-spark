# Tag Spark

A tag-based recommendation web app for Korean web fiction. Users explicitly
select the tags they want (include) or want to avoid (exclude), and Tag Spark
surfaces matching works. Instead of inferring taste from a hidden profile, the
user stays in **explicit control**.

> Language Engineer lens: this is less "a tag-based recommender" and more a
> lexical-resource project — structuring messy, user-generated tags into
> comparable signals through alias normalization, a hand-built similarity
> thesaurus, and hierarchical weighted scoring.

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
│   ├── assets/                 # icons, images, illustrations
│   ├── components/             # UI components (+ shadcn/ui primitives)
│   ├── hooks/
│   ├── lib/
│   │   ├── reco.ts             # Recommendation algorithm
│   │   ├── types.ts            # Shared TypeScript types
│   │   └── utils.ts            # Utility functions
│   ├── pages/
│   │   ├── Index.tsx           # Tag selection (mobile)
│   │   ├── List.tsx            # Work list with filters
│   │   ├── Onboarding.tsx      # First-time onboarding
│   │   ├── Recommend.tsx       # Recommendation results
│   │   ├── MobileLanding.tsx   # Mobile landing/lock screen
│   │   └── WebLanding.tsx      # Desktop landing
│   ├── App.tsx                 # Root component (providers)
│   ├── routes.tsx              # Route definitions
│   └── main.tsx                # Entry point
├── vercel.json                 # Vercel config (cron + rewrites)
├── vite.config.ts              # Vite config + local API middleware
└── tailwind.config.ts
```

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start dev server with HMR |
| `npm run build` | Production build |
| `npm run backfill:posted-at` | Add and backfill scraped publication dates |
| `npm run preview` | Preview production build |
| `npm run lint` | Run ESLint |

## Environment Variables

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | Neon Postgres connection string |

## Roadmap

Tag Spark follows an "interpretable baseline → data-driven → learned"
progression. **Phase 1** is what ships today; **Phase 2** is the planned
direction. Detailed design lives in the
[portfolio page](https://jiwoojeong.com/work/tag-spark-recommendations#tagspark-phase-two).

### Phase 1 — Current Production (shipped)

What runs today, grounded in the actual `src/lib/reco.ts` code.

**1-1. Explicit preference control.**
Users search, add, remove, and reverse preference tags. Included tags define the
desired result; excluded tag IDs filter out unwanted works before the remaining
catalog is ranked. Taste stays inspectable rather than inferred from a hidden
profile.

**1-2. Alias normalization.**
Each tag expands into its name plus known aliases. Tokens split on commas, middle
dots, slashes, and pipes, then pass through lowercasing, Unicode NFKC
normalization, whitespace removal, and punctuation stripping before set overlap
is evaluated. Surface variants of the same concept collapse into one signal.

**1-3. Hand-built similarity thesaurus.**
Semantically related tags are grouped into curated clusters and compiled into a
tag-to-tag similarity graph. Related concepts earn partial credit even when they
are not the same tag, so recommendations capture meaning, not just string
identity.

**1-4. Hierarchical, weighted scoring.**
Layered from strongest to weakest evidence: (1) exact tag match, (2) alias match
within the same category, (3) same-category (different tag), (4) cross-category
cluster similarity. Each layer is weighted by a per-dimension category weight,
and scores are length-normalized (divide by sqrt of tag count) so tag-heavy
works don't dominate.

**1-5. Catalog + operations.**
Works, tag relationships, publication dates, and engagement metadata are kept
current through a daily scrape cron, so ranking and browsing stay useful.

> Honesty note: clusters are hand-curated and similarity weights are fixed
> constants (not learned embeddings). This is a deliberate, interpretable
> rule-based baseline before model complexity.

### Phase 2 — Planned (next)

Extensions developed in design; not yet implemented.

**2-1. Move the thesaurus from code to data.**
Today the similarity thesaurus is hardcoded in `TAG_CLUSTERS_BY_NAME` with a
single global weight (0.6). Move it into a **`tag_similarity` table** (id-based,
per-edge weights, a `source` provenance column) so relationships can grow
without a redeploy and each relationship can carry its own strength. Start with a
behavior-preserving migration that keeps the 0.6 baseline exactly.

**2-2. Multi-axis mood space (embedding page).**
Treat tags by measurement type:
- **Continuous (comparable)** → spatial axes: **darkness** (healing/sweet ↔
  bleak/sad/bittersweet, validated) and **relational tension** (sweet ↔
  antagonistic). The two axes are only weakly correlated (~ −0.31), so they are
  effectively independent.
- **Binary (present/absent)** → filters: school setting, completion status, etc.
- **Nominal (multi-category)** → color: genre, worldview.

Place works in this space for "similar mood" exploration. Grounded in the
Valence–Arousal model, the Power–Danger reinterpretation for fiction
(ousiometrics), and CMU's FicSim tag-based similarity methodology.

**2-3. Platform-aware consumption — desktop map / mobile list.**
The value of the embedding is the *distance* (similarity), not showing every
point on one screen.
- **Desktop:** a 2D scatter exploration map.
- **Mobile (primary):** mood sliders that filter into a ranked list, plus a
  "similar works" list — avoiding small-screen overplotting.

The embedding is a cross-platform recommendation signal, not just a UI; it
improves recommendation quality even on mobile where the map isn't shown.

**2-4. Cold start (new visitors).**
Let new visitors pick a few favorites from a popular-works list (preference
elicitation), then aggregate the tags of the picked works into a taste starting
point. Because the system is content (tag) based, it can make a first
recommendation with zero behavioral data.

**2-5. Explicit-signal personalization.**
Learn taste incrementally from "more like this" and "not for me" — explicit
signals preferred over reading history (implicit, since "read ≠ liked"). A
**mood slider** lets users steer darkness/tension directly (Spotify Taste
Profile style: "the user tells the system what it can't infer"). Persist taste
with a signed anonymous token, not IP or device fingerprint.

**2-6. Validation.**
Make subjective tags measurable: collect pairwise comparisons ("is A darker than
B?") from a small trusted group with overlap, verify reliability with
inter-annotator agreement (IAA — Cohen's / Krippendorff), then learn tag weights
via Bradley-Terry / logistic regression. Validate with an A/B test once there is
user traffic.

**2-7. Learned similarity (embeddings).**
Compute tag co-occurrence or embedding cosine offline, write high-confidence
pairs as `source='embedding'`, and keep curated edges as an interpretable
backbone. A/B or blend curated / derived / embedding edges.

## How It Works (today)

1. The user selects tags describing their preferences (include / exclude).
2. The recommendation engine (`src/lib/reco.ts`) scores works by tag overlap,
   category weights, and alias matching, using the layered scoring above.
3. Results are ranked and displayed with relevant metadata.

## Deployment

Push to main → Vercel auto-deploys. The `api/` directory becomes serverless
functions, and `vercel.json` configures a daily scrape cron at 3 AM UTC.
