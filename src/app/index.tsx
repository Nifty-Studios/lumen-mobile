import { useState } from "react";
import { Alert, FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { Stack, router } from "expo-router";
import { pageTitle, type PageNode } from "@lumen/shared/client";
import { lumen } from "../db/lumen";
import { useLive } from "../data/hooks";
import { PageRow } from "../components/PageRow";
import { useColors } from "../theme";

interface Row {
  node: PageNode;
  depth: number;
}

const flatten = (nodes: PageNode[], open: Set<string>, depth = 0): Row[] =>
  nodes.flatMap((node) => [
    { node, depth },
    ...(open.has(node.page.id) ? flatten(node.children, open, depth + 1) : []),
  ]);

async function newPage(parentId: string | null) {
  const space = await lumen.getSpace();
  if (!space) return;
  const id = await lumen.createPage(space, parentId);
  router.push(`/page/${id}`);
}

export default function Home() {
  const c = useColors();
  const tree = useLive(async () => {
    const space = await lumen.getSpace();
    return space ? lumen.pageTree(space) : [];
  }, []);
  const [open, setOpen] = useState<Set<string>>(new Set());

  const toggle = (id: string) =>
    setOpen((prev) => {
      const next = new Set(prev);
      if (!next.delete(id)) next.add(id);
      return next;
    });

  const actions = (node: PageNode) =>
    Alert.alert(pageTitle(node.page), undefined, [
      { text: "Add sub-page", onPress: () => newPage(node.page.id).then(() => setOpen((p) => new Set(p).add(node.page.id))) },
      { text: "Move to trash", style: "destructive", onPress: () => lumen.setPageAlive(node.page.id, false) },
      { text: "Cancel", style: "cancel" },
    ]);

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <Stack.Screen
        options={{
          headerRight: () => (
            <View style={styles.headerButtons}>
              <Pressable onPress={() => router.push("/search")} hitSlop={8}>
                <Text style={[styles.headerButton, { color: c.text }]}>⌕</Text>
              </Pressable>
              <Pressable onPress={() => newPage(null)} hitSlop={8}>
                <Text style={[styles.headerButton, { color: c.text }]}>＋</Text>
              </Pressable>
            </View>
          ),
        }}
      />
      <FlatList
        data={tree ? flatten(tree, open) : []}
        keyExtractor={(r) => r.node.page.id}
        renderItem={({ item: { node, depth } }) => (
          <PageRow
            page={node.page}
            depth={depth}
            expanded={open.has(node.page.id)}
            hasChildren={node.children.length > 0}
            onToggle={() => toggle(node.page.id)}
            onPress={() => router.push(`/page/${node.page.id}`)}
            onLongPress={() => actions(node)}
          />
        )}
        ListEmptyComponent={
          tree ? <Text style={{ color: c.muted, padding: 24, textAlign: "center" }}>No pages yet. Tap ＋ to add one.</Text> : undefined
        }
        ListFooterComponent={
          <Pressable onPress={() => router.push("/trash")} android_ripple={{ color: c.hover }} style={styles.trash}>
            <Text style={{ color: c.muted, fontSize: 15 }}>🗑  Trash</Text>
          </Pressable>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  headerButtons: { flexDirection: "row", gap: 20, alignItems: "center" },
  headerButton: { fontSize: 24 },
  trash: { paddingHorizontal: 16, paddingVertical: 14, marginTop: 8 },
});
