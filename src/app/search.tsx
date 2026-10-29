import { useEffect, useState } from "react";
import { FlatList, Text, TextInput, View } from "react-native";
import { router } from "expo-router";
import type { Block } from "@lumen/shared/schema/client";
import { lumen } from "../db/lumen";
import { PageRow } from "../components/PageRow";
import { Icon } from "../components/Icon";
import { useColors } from "../theme";

interface Hit {
  page: Block;
  snippet: string;
}

export default function Search() {
  const c = useColors();
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<Hit[]>([]);

  useEffect(() => {
    let current = true;
    const t = setTimeout(async () => {
      const found = await lumen.search(query);
      const pages = await Promise.all(found.map(async (h) => ({ page: await lumen.getBlock(h.pageId), snippet: h.snippet })));
      if (current) setHits(pages.filter((h): h is Hit => !!h.page));
    }, 120);
    return () => {
      current = false;
      clearTimeout(t);
    };
  }, [query]);

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 10, margin: 12, paddingHorizontal: 14, borderRadius: 16, backgroundColor: c.hover }}>
        <Icon name="search" size={18} color={c.faint} />
        <TextInput
          autoFocus
          value={query}
          onChangeText={setQuery}
          placeholder="Search every page"
          placeholderTextColor={c.faint}
          style={{ flex: 1, paddingVertical: 12, color: c.text, fontSize: 16 }}
        />
      </View>
      <FlatList
        data={hits}
        keyboardShouldPersistTaps="handled"
        keyExtractor={(h) => h.page.id}
        contentContainerStyle={{ paddingHorizontal: 8 }}
        ListEmptyComponent={query ? <Text style={{ color: c.muted, padding: 24, textAlign: "center" }}>Nothing found for “{query}”</Text> : undefined}
        renderItem={({ item }) => <PageRow page={item.page} subtitle={item.snippet} onPress={() => router.replace(`/page/${item.page.id}`)} />}
      />
    </View>
  );
}
