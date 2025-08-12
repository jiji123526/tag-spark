🌟 Tag-Spark: Tag-based Recommendation Tool

A web application that recommends online novels based on selected tags.
Built with React, Vite, TypeScript, Tailwind, and shadcn/ui.

Live site: kwkrecom.vercel.app

⸻

✨ Features
	•	🔍 태그 검색 (including aliases) and selection by category
	•	✅ Complete Match Recommendations: Works containing all selected tags appear at the top
	•	🔄 Similar Recommendations: Up to 10 works based on similarity in tags, aliases, and categories
	•	🏷 Tag Chips: Selected tags displayed as chips on the results page
	•	🔗 Direct Links: Clicking a title opens the original link
	•	📋 Catalog View: Searchable/filterable table showing title, author, and tags
	•	📂 Navigation Menu: Links for viewing recommendations, adding works, and requesting tag edits

⸻

🛠 Tech Stack
	•	⚛️ React 18
	•	⚡ Vite
	•	🟦 TypeScript
	•	🗺 React Router
	•	🎨 Tailwind CSS
	•	🧩 shadcn/ui
	•	☁️ Deployment: Vercel

⸻

📂 Folder Structure

src/
　components/     # Header.tsx, WorkCard.tsx, ui/
　data/           # tags.ts, works.ts, workTags.ts
　lib/            # reco.ts
　pages/          # Index.tsx, Loading.tsx, Recommendations.tsx, CatalogSheet.tsx

⸻

🚀 Getting Started
	1.	Install dependencies
npm ci
	2.	Start development server
npm run dev
	3.	Optional type checking
npm run typecheck

⸻

📦 Build & Deploy

Deploy to Vercel
	1.	Push the repository to GitHub
	2.	On Vercel dashboard: Add New → Project → Select your repository
	3.	Framework: Vite
	4.	Build command: npm run build
	5.	Output directory: dist
	6.	Set Production Branch to main
	7.	Deploy — every push to main will trigger automatic deployment

Force deploy from CLI

npx vercel login
npx vercel link
npx vercel –prod

⸻

📊 Data Structure

1. Tags (src/data/tags.ts)
{id: number, name: string, category: “배경/시대” | “관계” | “분위기” | “장르” | “세계관” | “분량”, aliases?: string[]}

2. Works (src/data/works.ts)
{id: number, title: string, author: string, source_url: string}

3. Tag Mapping (src/data/workTags.ts)
{work_id: number, tag_id: number, weight: 1.0 | 2.0}

⸻

🧠 Recommendation Logic
	•	Complete Match: Includes all selected tags + sorted by total weight
	•	Similar Match: Based on similarity in tags, aliases, and categories, limited to top 10 results

⸻

🌐 Routes
	•	/ — Tag selection
	•	/loading — Loading screen
	•	/recommendations?tags=… — Recommendation results
	•	/catalog-sheet — Catalog of all registered works

⸻

📈 SEO & Social Preview
	•	Edit index.html to change title, description, and og:image
	•	Update preview using: Facebook Sharing Debugger, Twitter Card Validator, Kakao Link Scraper

⸻

⚠️ Common Issues
	•	Changes not reflected after push → Check Vercel Production Branch or trigger force deployment
	•	Commit email mismatch → git commit –amend –reset-author –no-edit && git push
	•	Dev server errors → npm ci && npm run dev

⸻

📜 License

Free for personal/non-commercial use.
For commercial use, contact the repository owner.