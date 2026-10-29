import { memo } from "react";
import { SvgXml } from "react-native-svg";
import { iconSvg, type IconName } from "@lumen/shared/icons";

/** An outline icon from the shared set. */
export const Icon = memo(function Icon({ name, size = 20, color, strokeWidth = 1.75 }: { name: IconName; size?: number; color: string; strokeWidth?: number }) {
  return <SvgXml xml={iconSvg(name, { size, color, strokeWidth })} width={size} height={size} />;
});
