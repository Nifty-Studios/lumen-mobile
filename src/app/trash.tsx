import { FlatList, Pressable, Text, View } from "react-native";
import { router } from "expo-router";
import { lumen } from "../db/lumen";
import { useLive } from "../data/hooks";
import { PageRow } from "../components/PageRow";
import { useColors } from "../theme";

export default function Trash() {
  const c = useColors();
  const pages = useLive(() => lumen.trashedPages(), []);

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <FlatList
        data={pages ?? []}
        keyExtractor={(p) => p.id}
        renderItem={({ item }) => (
          <View style={{ flexDirection: "row", alignItems: "center" }}>
            <View style={{ flex: 1 }}>
              <PageRow page={item} onPress={() => router.push(`/page/${item.id}`)} />
            </View>
            <Pressable onPress={() => lumen.setPageAlive(item.id, true)} hitSlop={8} style={{ paddingHorizontal: 16 }}>
              <Text style={{ color: c.accent, fontWeight: "600" }}>Restore</Text>
            </Pressable>
          </View>
        )}
        ListEmptyComponent={pages ? <Text style={{ color: c.muted, padding: 24, textAlign: "center" }}>Trash is empty.</Text> : undefined}
      />
    </View>
  );
}
