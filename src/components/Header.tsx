import { useEffect, useRef, useState } from "react";
import { Menu } from "lucide-react";
import { Link } from "react-router-dom";

const Header = () => {
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);

  // 바깥 클릭 시 닫기
  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      if (!menuRef.current) return;
      if (!menuRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  return (
    <header className="fixed top-0 left-0 right-0 z-40 border-b bg-background/80 backdrop-blur">
      <div className="container flex h-14 items-center justify-between">
        {/* 제목을 index.tsx("/")로 연결 */}
        <Link
          to="/index"
          aria-label="Site title"
          className="font-semibold tracking-tight hover:underline"
        >
          칼과 윈 포타 추천기
        </Link>

        {/* 메뉴 버튼 + 드롭다운 */}
        <div className="relative" ref={menuRef}>
          <button
            type="button"
            aria-label="Open menu"
            aria-haspopup="menu"
            aria-expanded={open}
            onClick={() => setOpen((v) => !v)}
            className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-input hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          >
            <Menu className="size-5" />
          </button>

          {open && (
            <div
              role="menu"
              aria-label="Quick links"
              className="absolute right-0 mt-2 w-64 overflow-hidden rounded-md border bg-popover text-popover-foreground shadow-md"
            >
              {/* 내부 페이지 이동 */}
              <Link
                to="/catalog-sheet"
                role="menuitem"
                className="block px-3 py-2 text-sm hover:bg-accent hover:text-accent-foreground"
                onClick={() => setOpen(false)}
              >
                현재 등록된 추천작 보기
              </Link>

              {/* 외부 링크 */}
              <a
                href="https://docs.google.com/forms/d/e/1FAIpQLSf_SdK01Mas2ZVMeXG3-AOTdFsIMyjLRAyCMWFvpg3YZaFnkw/viewform?usp=sharing&ouid=103167940717310868379" // ← 실제 외부 링크로 교체
                target="_blank"
                rel="noopener noreferrer"
                role="menuitem"
                className="block px-3 py-2 text-sm hover:bg-accent hover:text-accent-foreground"
                onClick={() => setOpen(false)}
              >
                내 추천작 등록하기
              </a>
              <a
                href="https://docs.google.com/forms/d/e/1FAIpQLScU-elPQxC2vlIifZkISf8Z6jhAC3zZA1Anw8-Xa8kY7gc-Sg/viewform" // ← 실제 외부 링크로 교체
                target="_blank"
                rel="noopener noreferrer"
                role="menuitem"
                className="block px-3 py-2 text-sm hover:bg-accent hover:text-accent-foreground"
                onClick={() => setOpen(false)}
              >
                키워드 수정 요청
              </a>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};

export default Header;