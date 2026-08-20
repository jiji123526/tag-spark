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

export function ThemeProvider({ children, ...props }: ThemeProviderProps) {
  const storageKey = props.storageKey ?? "theme";

  return (
    <NextThemesProvider {...props}>
      <SystemThemeSync storageKey={storageKey} />
      {children}
    </NextThemesProvider>
  );
}
