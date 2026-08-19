import { useEffect } from "react";
import { Routes, Route, useLocation } from "react-router-dom";
import WebLanding from "./pages/WebLanding";
import MobileLanding from "./pages/MobileLanding";
import Loading from "./pages/Loading";
import NotFound from "./pages/NotFound";
import Onboarding from "./pages/Onboarding";
import Index from "./pages/Index";
import Recommend from "./pages/Recommend";
import List from "./pages/List";
import WeatherTest from "./pages/WeatherTest";

const isMobile =
  /android|iphone|ipod|ipad|mobile/i.test(navigator.userAgent) ||
  (typeof window !== "undefined" && window.matchMedia("(max-width: 820px)").matches);

const PAGE_TITLES: Record<string, string> = {
  "/": "오늘은 뭘 읽을까?",
  "/landing": "오늘은 뭘 읽을까?",
  "/mobilelanding": "오늘은 뭘 읽을까?",
  "/onboarding": "오늘은 뭘 읽을까?",
  "/loading": "추천작 준비중…",
  "/mobile-index": "키워드 선택하기",
  "/mobile-recom": "키워드 매칭 결과",
  "/mobile-list": "현재 등록된 추천작",
  "/weather-test": "🧪 Weather Controls",
};

const AppRoutes = () => {
  const { pathname } = useLocation();

  useEffect(() => {
    const normalizedPath = pathname.replace(/\/+$/, "").toLowerCase() || "/";
    document.title = PAGE_TITLES[normalizedPath] ?? "404";
  }, [pathname]);

  return (
    <Routes>
      <Route path="/" element={isMobile ? <MobileLanding /> : <WebLanding />} />
      <Route path="/landing" element={<MobileLanding />} />
      <Route path="/MobileLanding" element={<MobileLanding />} />
      <Route path="/loading" element={<Loading />} />
      <Route path="/onboarding" element={<Onboarding />} />
      <Route path="/mobile-index" element={<Index />} />
      <Route path="/mobile-recom" element={<Recommend />} />
      <Route path="/mobile-list" element={<List />} />
      <Route path="/weather-test" element={<WeatherTest />} />
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
};

export default AppRoutes;
