# 📌 tagspark

### ✨ Project Overview
**tagspark** is a **user-tailored content recommendation service**.  
Users select keywords, and the system automatically recommends works that match those tags, presented in an intuitive UI/UX for easy exploration.  

---

## 🎯 Problem Statement
- When discovering new works/content, users often lack **personalized recommendation services**.  
- Search-based systems are limited in providing **personalized experiences**.  
- Users need a solution to **quickly and easily find works that fit their interests**.  

---

## 💡 Solution
- **Tag-based recommendations**: Users select keywords to filter works.  
- **Intuitive UI**: Smooth flow from keyword selection → recommendation list.  
- **Additional features**:  
  - Gradient fade for scrollable text to improve readability.  
  - Loading page to enhance mobile page transition experience.  

---

## 🛠 Tech Stack
- **Frontend**: React, TypeScript  
- **UI/UX**: Tailwind CSS, custom modules  
- **State Management**: React hooks  
- **Deployment**: Vercel

---

## 🚀 Key Features
1. **Keyword Selection**
   - Users can add or remove keywords.  
   - Excluded keywords are displayed for flexible filtering.  

2. **Recommendation List**
   - Recommended works update automatically based on keywords.  
   - Long text handled with scroll + gradient fade to avoid clipping.  

3. **UX Enhancements**
   - Loading page shown during mobile page transitions.  
   - Fixed layout issues such as clipped or misaligned text.  

---

## 📊 Product Planning Highlights (TPM Perspective)
- **MVP:** Keyword selection → Display recommendation list.  
- **Next Steps:**  
  - Store user interaction logs → Analyze popular keywords.  
  - Implement simple recommendation logic (e.g., keyword clustering).  
  - Integrate Firebase/Supabase for data storage and personalization.  
- **Expansion:**  
  - Provide AI-powered content summaries (LLM API).  
  - Conduct A/B testing to measure UI and recommendation performance.  

---

## 🔍 Collaboration Considerations
- **Design team:** Improve layout and user experience for tag/recommendation flow.  
- **Backend team:** Manage content database, build recommendation APIs.  
- **Data team:** Analyze user behavior logs, enhance recommendation quality.  

---

## 📈 Future Improvements
- AI-based recommendation (using LLM APIs).  
- Deeper personalization via user behavior analysis.  
- Admin dashboard to monitor popular tags and recommendation performance.  

---
