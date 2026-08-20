import { useEffect } from "react";
import { ThemeProvider as NextThemesProvider, type ThemeProviderProps } from "next-themes";

export function ThemeProvider({ children, ...props }: ThemeProviderProps) {
  const storageKey = props.storageKey ?? "theme";

  useEffect(() => {
    window.localStorage.removeItem(storageKey);
  }, [storageKey]);

  return <NextThemesProvider {...props} forcedTheme="system">{children}</NextThemesProvider>;
}
