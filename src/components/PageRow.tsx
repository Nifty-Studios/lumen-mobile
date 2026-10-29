import { Pressable, StyleSheet, Text, View } from "react-native";
import { pageTitle } from "@lumen/shared/client";
import { iconColor, resolveIcon } from "@lumen/shared/icons";
import type { Block } from "@lumen/shared/schema/client";
import { useColors } from "../theme";
import { Icon } from "./Icon";

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
  const icon = resolveIcon(page.format.icon);
  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      android_ripple={{ color: c.hover, borderless: false }}
      style={[styles.row, { paddingLeft: 10 + depth * 18 }]}
    >
      {onToggle ? (
        <Pressable onPress={onToggle} hitSlop={10} style={[styles.chevron, { opacity: hasChildren ? 1 : 0.3 }]}>
          <View style={{ transform: [{ rotate: expanded ? "90deg" : "0deg" }] }}>
            <Icon name="chevron-right" size={16} color={c.faint} />
          </View>
        </Pressable>
      ) : null}
      <View style={[styles.tile, { backgroundColor: c.hover }]}>
        <Icon name={icon.name} size={18} color={iconColor(icon.color, c.dark) ?? c.muted} />
      </View>
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
  row: { flexDirection: "row", alignItems: "center", paddingVertical: 8, paddingRight: 16, gap: 10, borderRadius: 14 },
  chevron: { width: 20, alignItems: "center" },
  tile: { width: 34, height: 34, borderRadius: 11, alignItems: "center", justifyContent: "center" },
});
