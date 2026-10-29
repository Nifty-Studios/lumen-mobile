import { useColorScheme } from "react-native";

const light = { bg: "#ffffff", text: "#37352f", muted: "#91918e", hover: "#f1f1ef", border: "#e9e9e7", accent: "#2383e2", danger: "#e03e3e" };
const dark: typeof light = { bg: "#191919", text: "#e6e6e4", muted: "#7f7f7c", hover: "#2a2a2a", border: "#2f2f2f", accent: "#529cca", danger: "#ff7369" };

export type Colors = typeof light;
export const useColors = (): Colors & { dark: boolean } => {
  const isDark = useColorScheme() === "dark";
  return { ...(isDark ? dark : light), dark: isDark };
};
