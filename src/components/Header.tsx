import { Menu } from "lucide-react";
const Header = () => {
  return <header className="fixed top-0 left-0 right-0 z-40 border-b bg-background/80 backdrop-blur">
      <div className="container flex h-14 items-center justify-between">
        <span aria-label="Site title" className="font-semibold tracking-tight">오늘은 뭘 읽을까?</span>
        <button aria-label="Open menu" className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-input hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2">
          <Menu className="size-5" />
        </button>
      </div>
    </header>;
};
export default Header;