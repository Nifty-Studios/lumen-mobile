import type { ThemeTokens } from "@lumen/shared/ambient";
import { useAmbient } from "./ambient/AmbientProvider";

export interface Colors {
  dark: boolean;
  /** Opaque page background (the glass, flattened: no blur on Android). */
  bg: string;
  surface: string;
  text: string;
  muted: string;
  faint: string;
  hover: string;
  active: string;
  border: string;
  accent: string;
  accentSoft: string;
  accentText: string;
  danger: string;
  scrim: string;
  shadow: string;
  tokens: ThemeTokens;
}

/** Theme colors that follow the sky (shared/ambient/theme.ts). */
export const useColors = (): Colors => {
  const { theme: t } = useAmbient();
  return {
    dark: t.dark,
    bg: t.solid,
    surface: t.surface,
    text: t.text,
    muted: t.muted,
    faint: t.faint,
    hover: t.hover,
    active: t.active,
    border: t.border,
    accent: t.accent,
    accentSoft: t.accentSoft,
    accentText: t.accentText,
    danger: t.danger,
    scrim: t.scrim,
    shadow: t.shadow,
    tokens: t,
  };
};

export const FONTS = {
  serif: "Fraunces_600SemiBold",
  serifLight: "Fraunces_300Light",
} as const;
