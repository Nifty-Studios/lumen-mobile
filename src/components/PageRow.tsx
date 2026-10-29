import { Pressable, StyleSheet, Text, View } from "react-native";
import { pageTitle } from "@lumen/shared/client";
import type { Block } from "@lumen/shared/schema/client";
import { useColors } from "../theme";

export const pageIcon = (page: Block) => (page.format.icon?.type === "emoji" ? page.format.icon.value : "📄");

interface Props {
  page: Block;
  depth?: number;
  expanded?: boolean;
  hasChildren?: boolean;
  onPress: () => void;
  onLongPress?: () => void;
  onToggle?: () => void;
  subtitle?: string;
}

export function PageRow({ page, depth = 0, expanded, hasChildren, onPress, onLongPress, onToggle, subtitle }: Props) {
  const c = useColors();
  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      android_ripple={{ color: c.hover }}
      style={[styles.row, { paddingLeft: 12 + depth * 18 }]}
    >
      {onToggle ? (
        <Pressable onPress={onToggle} hitSlop={10} style={styles.chevron}>
          <Text style={{ color: c.muted, fontSize: 12, opacity: hasChildren ? 1 : 0.35 }}>{expanded ? "▼" : "▶"}</Text>
        </Pressable>
      ) : null}
      <Text style={styles.icon}>{pageIcon(page)}</Text>
      <View style={{ flex: 1 }}>
        <Text numberOfLines={1} style={{ color: c.text, fontSize: 16 }}>
          {pageTitle(page)}
        </Text>
        {subtitle ? (
          <Text numberOfLines={1} style={{ color: c.muted, fontSize: 13, marginTop: 2 }}>
            {subtitle}
          </Text>
        ) : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", paddingVertical: 11, paddingRight: 16, gap: 8 },
  chevron: { width: 18, alignItems: "center" },
  icon: { fontSize: 18, width: 26, textAlign: "center" },
});
