import { FlatList, Pressable, Text, View } from "react-native";
import { router } from "expo-router";
import { lumen } from "../db/lumen";
import { useLive } from "../data/hooks";
import { PageRow } from "../components/PageRow";
import { Icon } from "../components/Icon";
import { useColors } from "../theme";

export default function Trash() {
  const c = useColors();
  const pages = useLive(() => lumen.trashedPages(), []);

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <FlatList
        data={pages ?? []}
        keyExtractor={(p) => p.id}
        contentContainerStyle={{ paddingHorizontal: 8, paddingTop: 4 }}
        renderItem={({ item }) => (
          <View style={{ flexDirection: "row", alignItems: "center" }}>
            <View style={{ flex: 1 }}>
              <PageRow page={item} onPress={() => router.push(`/page/${item.id}`)} />
            </View>
            <Pressable
              onPress={() => lumen.setPageAlive(item.id, true)}
              hitSlop={8}
              style={{ flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 12, paddingVertical: 8, marginRight: 6, borderRadius: 12, backgroundColor: c.accentSoft }}
            >
              <Icon name="archive-restore" size={16} color={c.accent} />
              <Text style={{ color: c.accent, fontWeight: "600" }}>Restore</Text>
            </Pressable>
          </View>
        )}
        ListEmptyComponent={
          pages ? (
            <View style={{ alignItems: "center", padding: 40, gap: 10 }}>
              <Icon name="trash" size={28} color={c.faint} />
              <Text style={{ color: c.muted }}>Nothing in the trash.</Text>
            </View>
          ) : undefined
        }
      />
    </View>
  );
}
