import Header from "@/components/Header";
import { useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";

const Loading = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  useEffect(() => {
    document.title = "추천작 준비중";
    const tags = searchParams.get("tags") || "";

    const id = setTimeout(() => {
      navigate(`/recommendations?tags=${tags}`);
    }, 800);

    return () => clearTimeout(id);
  }, [navigate, searchParams]);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Header />
      <main className="container flex min-h-[60vh] flex-col items-center justify-center pt-20">
        <div className="mb-4 h-10 w-10 animate-spin rounded-full border-2 border-muted-foreground border-t-primary" aria-label="Loading spinner" />
        <p className="text-sm text-muted-foreground">추천작 준비중…</p>
      </main>
    </div>
  );
};

export default Loading;
