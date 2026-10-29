import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Alert, FlatList, Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { Stack, router, useFocusEffect, useLocalSearchParams } from "expo-router";
import type { PartialBlock } from "@blocknote/core";
import { pageTitle } from "@lumen/shared/client";
import { isEditorBlock, toEditorBlock } from "@lumen/shared/editor";
import type { Block } from "@lumen/shared/schema/client";
import type { PageSession } from "@lumen/shared/client";
import { lumen } from "../../db/lumen";
import { useLive } from "../../data/hooks";
import PageEditor, { type PageEditorRef } from "../../components/PageEditor";
import { pageIcon } from "../../components/PageRow";
import { useColors } from "../../theme";

const EMOJIS = ["📄", "📝", "📌", "💡", "✅", "📚", "🎯", "🗂", "🧠", "🚀", "🌱", "⭐", "🔥", "🎨", "🛠", "📅", "💼", "🏠", "✈️", "🍳", "🎵", "💬", "🔒", "👋"];

export default function PageScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const c = useColors();
  const editor = useRef<PageEditorRef>(null);
  const page = useLive(() => lumen.getBlock(id), [id]);
  const [picking, setPicking] = useState(false);

  // The editor's blocks load once per page; after that the editor owns the document.
  const [session, setSession] = useState<PageSession>();
  useEffect(() => {
    lumen.openPage(id).then(setSession, console.error);
  }, [id]);
  const blocks = session?.blocks;

  // Save pending edits whenever the screen loses focus (back, or opening a sub-page).
  // flush only exists once the webview has loaded; before that there is nothing to save.
  useFocusEffect(useCallback(() => () => editor.current?.flush?.(), []));

  const loaded = !!page && !!blocks;
  const initial = useMemo(() => {
    if (!page || !blocks) return undefined;
    const top = page.content
      .map((b) => blocks.get(b))
      .filter((b): b is Block => !!b && isEditorBlock(b.type))
      .map((b) => toEditorBlock(b, blocks));
    return { title: pageTitle(page) === "Untitled" ? "" : pageTitle(page), content: top.length ? (top as PartialBlock[]) : null };
    // Only the first load matters: later page updates come from this editor.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loaded]);

  if (!page || !initial) return <View style={{ flex: 1, backgroundColor: c.bg }} />;

  const menu = () =>
    Alert.alert(pageTitle(page), undefined, [
      {
        text: "Add sub-page",
        onPress: async () => {
          const space = await lumen.getSpace();
          if (space) router.push(`/page/${await lumen.createPage(space, page.id)}`);
        },
      },
      page.alive
        ? { text: "Move to trash", style: "destructive", onPress: () => lumen.setPageAlive(page.id, false).then(() => router.back()) }
        : { text: "Restore", onPress: () => lumen.setPageAlive(page.id, true) },
      { text: "Cancel", style: "cancel" },
    ]);

  const pick = (emoji: string | null) => {
    lumen.setPageIcon(page.id, emoji).catch(console.error);
    setPicking(false);
  };

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <Stack.Screen
        options={{
          title: pageTitle(page),
          headerRight: () => (
            <View style={styles.headerButtons}>
              <Pressable onPress={() => setPicking(true)} hitSlop={8}>
                <Text style={{ fontSize: 22 }}>{pageIcon(page)}</Text>
              </Pressable>
              <Pressable onPress={menu} hitSlop={8}>
                <Text style={{ fontSize: 22, color: c.text }}>⋯</Text>
              </Pressable>
            </View>
          ),
        }}
      />
      {!page.alive && (
        <Pressable onPress={() => lumen.setPageAlive(page.id, true)} style={[styles.banner, { backgroundColor: c.danger + "22" }]}>
          <Text style={{ color: c.text }}>This page is in the trash. Tap to restore.</Text>
        </Pressable>
      )}
      <PageEditor
        ref={editor}
        dom={{ style: { flex: 1 }, containerStyle: { flex: 1 } }}
        title={initial.title}
        initialContent={initial.content}
        dark={c.dark}
        onSave={(doc) => session!.save(doc)}
        onRename={(title) => lumen.renamePage(id, title)}
      />
      <Modal visible={picking} transparent animationType="fade" onRequestClose={() => setPicking(false)}>
        <Pressable style={styles.backdrop} onPress={() => setPicking(false)}>
          <View style={[styles.sheet, { backgroundColor: c.bg, borderColor: c.border }]}>
            <FlatList
              data={EMOJIS}
              numColumns={6}
              keyExtractor={(e) => e}
              renderItem={({ item }) => (
                <Pressable style={styles.emoji} onPress={() => pick(item)}>
                  <Text style={{ fontSize: 28 }}>{item}</Text>
                </Pressable>
              )}
            />
            <Pressable style={styles.remove} onPress={() => pick(null)}>
              <Text style={{ color: c.muted }}>Remove icon</Text>
            </Pressable>
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  headerButtons: { flexDirection: "row", gap: 20, alignItems: "center" },
  banner: { paddingHorizontal: 16, paddingVertical: 10 },
  backdrop: { flex: 1, backgroundColor: "#0006", justifyContent: "center", padding: 24 },
  sheet: { borderRadius: 14, borderWidth: StyleSheet.hairlineWidth, padding: 12 },
  emoji: { flex: 1, alignItems: "center", paddingVertical: 8 },
  remove: { alignItems: "center", paddingTop: 10 },
});
