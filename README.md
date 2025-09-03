# 🌟 Tag-Spark: Tag-based Recommendation Tool  

**Tag-Spark** is a web application that recommends online novels based on selected tags.  
Built with **React**, **Vite**, **TypeScript**, **Tailwind**, and **shadcn/ui**.  

---

## ✨ Key Features  

- 🔍 **Tag Search & Selection**  
  - Search tags (with aliases) and filter by category.  

- ✅ **Exact Match Recommendations**  
  - Works containing *all* selected tags appear at the top.  

- 🔄 **Similarity-based Recommendations**  
  - Up to 10 additional works suggested using tag, alias, and category similarity.  

- 🏷 **Tag Chips**  
  - Selected tags displayed as interactive chips on the results page.  

- 🔗 **Direct Links**  
  - Click a title to open its original source.  

- 📋 **Catalog View**  
  - Searchable, filterable catalog of works with title, author, and tags.  

- 📂 **Navigation Menu**  
  - Access recommendations, add works, or request tag edits.  

---

## 📊 Product Planning Highlights (TPM Perspective)  

- **MVP Definition:**  
  - Core flow: Tag selection → Recommendation results.  
  - Focused on speed and intuitive interaction.  

- **Next Steps:**  
  - Collect anonymous interaction logs (popular tags, click-throughs).  
  - Enhance recommendation pipeline with clustering logic.  
  - Add persistence and personalization via Firebase/Supabase.  

- **Expansion Opportunities:**  
  - Integrate AI-powered content summaries (LLM API).  
  - Run A/B testing on recommendation ranking and UI variations.  
  - Build an admin dashboard to track usage trends and tag popularity.  

## 🧩 System Pipeline  

1. **Input: Tag Selection**  
   - Users search and select tags.  
   - Aliases and categories are automatically resolved.  

2. **Processing: Recommendation Engine**  
   - **Exact Match**: Filters works containing all chosen tags.  
   - **Similarity Match**: Calculates similarity scores based on:  
     - Shared tags  
     - Alias matching  
     - Category overlap  
   - Sorts results by weight and limits similar matches to top 10.  

3. **Output: Recommendation Results**  
   - Displays prioritized exact matches, followed by similar works.  
   - Includes direct links and tag chips for context.  

---

## 🛠 Tech Stack  

- ⚛️ React 18  
- ⚡ Vite  
- 🟦 TypeScript  
- 🗺 React Router  
- 🎨 Tailwind CSS  
- 🧩 shadcn/ui  
- ☁️ Deployment: Vercel  

---

## 📂 Project Structure  

```
src/  
 ├─ components/   # UI components (Header, WorkCard, etc.)  
 ├─ data/         # Static data: tags.ts, works.ts, workTags.ts  
 ├─ lib/          # Core logic (recommendation pipeline)  
 ├─ pages/        # App pages (Index, Loading, Recommendations, CatalogSheet)  
```  

---

## 🚀 Getting Started  

```bash
# 1. Install dependencies
npm ci

# 2. Start development server
npm run dev

# 3. Optional: Type checking
npm run typecheck
```  

---

## 📦 Build & Deployment  

- **Deploy to Vercel**:  
  1. Push repository to GitHub  
  2. On Vercel: Add New → Project → Select Repo  
  3. Framework: Vite  
  4. Build command: `npm run build`  
  5. Output directory: `dist`  
  6. Deploy → Automatic on `main` branch  

---

## 📊 Data Model  

**Tags (tags.ts)**  
```ts
{id: number, name: string, category: string, aliases?: string[]}
```  

**Works (works.ts)**  
```ts
{id: number, title: string, author: string, source_url: string}
```  

**Tag Mapping (workTags.ts)**  
```ts
{work_id: number, tag_id: number, weight: number}
```  

---

## 📈 Routes  

- `/` — Tag selection  
- `/loading` — Loading screen  
- `/recommendations?tags=…` — Recommendation results  
- `/catalog-sheet` — Catalog of all works  

---

## ⚠️ Common Issues  

- Changes not reflected → check Vercel branch or trigger force deploy.  
- Dev server errors → run `npm ci && npm run dev`.  

---

## 📜 License  

Free for personal/non-commercial use.  
For commercial use, please contact the repository owner.  

