import { Routes, Route } from "react-router-dom";
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

const AppRoutes = () => (
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

export default AppRoutes;
