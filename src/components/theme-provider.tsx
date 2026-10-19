import { useEffect } from "react";
import { ThemeProvider as NextThemesProvider, useTheme, type ThemeProviderProps } from "next-themes";

function SystemThemeSync({ storageKey }: { storageKey: string }) {
  const { setTheme } = useTheme();

  useEffect(() => {
    window.localStorage.removeItem(storageKey);
    setTheme("system");
  }, [setTheme, storageKey]);

  return null;
}

function BrowserThemeSync() {
  const { resolvedTheme } = useTheme();

  useEffect(() => {
    if (resolvedTheme !== "light" && resolvedTheme !== "dark") return;
    const isDark = resolvedTheme === "dark";
    const themeColor = isDark ? "#0c1016" : "#ffffff";
    const themeColorMeta = document.querySelector('meta[name="theme-color"]');
    themeColorMeta?.setAttribute("content", themeColor);
    document.documentElement.style.setProperty("color-scheme", isDark ? "dark" : "light");
  }, [resolvedTheme]);

  return null;
}

export function ThemeProvider({ children, ...props }: ThemeProviderProps) {
  const storageKey = props.storageKey ?? "theme";

  return (
    <NextThemesProvider {...props}>
      <SystemThemeSync storageKey={storageKey} />
      <BrowserThemeSync />
      {children}
    </NextThemesProvider>
  );
}
