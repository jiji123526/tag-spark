import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import "./components/global.css";

import Index from "./pages/Index";
import WebLanding from "./pages/WebLanding";
import MobileLanding from "./pages/MobileLanding";
import Loading from "./pages/Loading";
import Recommendations from "./pages/Recommendations";
import CatalogSheet from "./pages/CatalogSheet"; // ✅ 추가
import NotFound from "./pages/NotFound";
import Onboarding from "./pages/OnBoarding";

const isMobile =
  /android|iphone|ipod|ipad|mobile/i.test(navigator.userAgent) ||
  (typeof window !== "undefined" && window.matchMedia("(max-width: 820px)").matches);

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={isMobile ? <MobileLanding /> : <WebLanding />} />
          <Route path="/landing" element={<MobileLanding />} />
          <Route path="/MobileLanding" element={<MobileLanding />} /> {/* alias for back button */}
          <Route path="/index" element={<Index />} />
          <Route path="/loading" element={<Loading />} />
          <Route path="/recommendations" element={<Recommendations />} />
          <Route path="/catalog-sheet" element={<CatalogSheet />} /> {/* ✅ 현재 등록된 추천작(시트) */}
          <Route path="/onboarding" element={<Onboarding />} />

          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} /> {/* ✅ 캐치올 */}
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;