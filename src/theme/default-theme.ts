export type IStoreThemePreset = "default" | "custom";
export type IStoreThemeMode = "light" | "dark" | "system";

export const ISTORE_DEFAULT_THEME = {
  light: {
    primaryColor: "#EE4D2D",
    secondaryColor: "#212121",
    brandTextColor: "#212121",
    accentColor: "#FFB800",
    hoverColor: "#D93F22",
    backgroundColor: "#F5F5F5",
    surfaceColor: "#FFFFFF",
    textColor: "#212121",
    textSecondaryColor: "#757575",
    borderColor: "#E5E5E5",
    headerBackgroundColor: "#FFFFFF",
    headerTextColor: "#212121",
  },
  dark: {
    primaryColor: "#EE4D2D",
    secondaryColor: "#F5F5F5",
    brandTextColor: "#FFFFFF",
    accentColor: "#FFB800",
    hoverColor: "#FF6A4A",
    backgroundColor: "#121212",
    surfaceColor: "#1E1E1E",
    textColor: "#F5F5F5",
    textSecondaryColor: "#B3B3B3",
    borderColor: "#333333",
    headerBackgroundColor: "#161616",
    headerTextColor: "#FFFFFF",
  },
} as const;

export type IStoreThemeTokens = typeof ISTORE_DEFAULT_THEME.light;

export function getIStoreDefaultTheme(mode: Exclude<IStoreThemeMode, "system">): IStoreThemeTokens {
  return ISTORE_DEFAULT_THEME[mode];
}
