import { View } from "react-native";
import { stickerOf } from "@lumen/shared/calendar";
import { iconColor } from "@lumen/shared/icons";
import { Icon } from "./Icon";
import { useColors } from "../theme";

/** A calendar sticker: its icon in a soft disc of its color. */
export function StickerBadge({ sticker, size = 24 }: { sticker: string; size?: number }) {
  const c = useColors();
  const s = stickerOf(sticker);
  const color = iconColor(s.color, c.dark) ?? c.accent;
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, alignItems: "center", justifyContent: "center", backgroundColor: color + "33" }}>
      <Icon name={s.icon} size={Math.round(size * 0.6)} color={color} />
    </View>
  );
}

export function formatHm(hm: string, clock: "auto" | "12h" | "24h") {
  const [h, m] = hm.split(":").map(Number);
  const d = new Date();
  d.setHours(h ?? 0, m ?? 0, 0, 0);
  return d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit", ...(clock === "12h" ? { hour12: true } : clock === "24h" ? { hourCycle: "h23" as const } : {}) });
}
