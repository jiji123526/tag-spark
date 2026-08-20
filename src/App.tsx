import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter } from "react-router-dom";
import { useEffect } from "react";
import { recoDataQueryOptions, tagsQueryOptions } from "@/lib/queries";
import { ThemeProvider } from "@/components/theme-provider";
import "./styles/global.css";
import AppRoutes from "./routes";

const queryClient = new QueryClient();

const App = () => {
  useEffect(() => {
    void queryClient.prefetchQuery(tagsQueryOptions);

    const prefetchRecoData = () => {
      void queryClient.prefetchQuery(recoDataQueryOptions);
    };
    if ("requestIdleCallback" in window) {
      const id = window.requestIdleCallback(prefetchRecoData, { timeout: 3000 });
      return () => window.cancelIdleCallback(id);
    }
    const id = window.setTimeout(prefetchRecoData, 1000);
    return () => window.clearTimeout(id);
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <AppRoutes />
          </BrowserRouter>
        </TooltipProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
};

export default App;
