import { useEffect, useState } from "react";
import { FlatList, TextInput, View } from "react-native";
import { router } from "expo-router";
import type { Block } from "@lumen/shared/schema/client";
import { lumen } from "../db/lumen";
import { PageRow } from "../components/PageRow";
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
      <TextInput
        autoFocus
        value={query}
        onChangeText={setQuery}
        placeholder="Search pages"
        placeholderTextColor={c.muted}
        style={{ margin: 12, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 10, backgroundColor: c.hover, color: c.text, fontSize: 16 }}
      />
      <FlatList
        data={hits}
        keyboardShouldPersistTaps="handled"
        keyExtractor={(h) => h.page.id}
        renderItem={({ item }) => (
          <PageRow page={item.page} subtitle={item.snippet} onPress={() => router.replace(`/page/${item.page.id}`)} />
        )}
      />
    </View>
  );
}
