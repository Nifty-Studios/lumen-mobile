import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Alert, FlatList, Modal, Pressable, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { Stack, router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { PartialBlock } from "@blocknote/core";
import { pageTitle } from "@lumen/shared/client";
import { isEditorBlock, toEditorBlock } from "@lumen/shared/editor";
import { ICON_COLORS, PAGE_ICON_NAMES, iconColor, resolveIcon, type IconColor } from "@lumen/shared/icons";
import type { Block } from "@lumen/shared/schema/client";
import type { PageSession, RemoteUpdate } from "@lumen/shared/client";
import { lumen } from "../../db/lumen";
import { useLive } from "../../data/hooks";
import PageEditor, { type PageEditorRef } from "../../components/PageEditor";
import { SkyCard } from "../../ambient/SkyCard";
import { useAmbient } from "../../ambient/AmbientProvider";
import { Icon } from "../../components/Icon";
import { useColors } from "../../theme";

export default function PageScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const c = useColors();
  const editor = useRef<PageEditorRef>(null);
  const page = useLive(() => lumen.getBlock(id), [id]);
  const [picking, setPicking] = useState(false);
  const readOnly = useLive(() => lumen.roleOf(id), [id]) === "viewer";
  const { settings } = useAmbient();
  const glass = settings.skyBehindPage;
  const headerHeight = useSafeAreaInsets().top + 56; // Android's stack header
  const { height } = useWindowDimensions();

  // The editor's blocks load once per page; after that the editor owns the document.
  const [session, setSession] = useState<PageSession>();
  useEffect(() => {
    let open: PageSession | undefined;
    lumen.openPage(id).then((s) => setSession((open = s)), console.error);
    return () => open?.close();
  }, [id]);
  const blocks = session?.blocks;

  // Other devices' edits, handed to the editor as they arrive (seq tells it something is new).
  const [remote, setRemote] = useState<{ seq: number; update: RemoteUpdate }>();
  useEffect(() => session?.onRemote((update) => setRemote((r) => ({ seq: (r?.seq ?? 0) + 1, update }))), [session]);

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

  const icon = page.format.icon ? resolveIcon(page.format.icon) : null;
  const share = lumen.account.available ? [{ text: "Share", onPress: () => router.push(`/share/${page.id}`) }] : [];
  const menu = () =>
    Alert.alert(pageTitle(page), readOnly ? "You can view this page, not change it." : undefined, readOnly ? [...share, { text: "Close", style: "cancel" }] : [
      ...share,
      {
        text: "Add sub-page",
        onPress: async () => {
          const space = await lumen.getSpace();
          if (space) router.push(`/page/${await lumen.createPage(space, page.id)}`);
        },
      },
      { text: "Change icon", onPress: () => setPicking(true) },
      page.alive
        ? { text: "Move to trash", style: "destructive", onPress: () => lumen.setPageAlive(page.id, false).then(() => router.back()) }
        : { text: "Restore", onPress: () => lumen.setPageAlive(page.id, true) },
      { text: "Cancel", style: "cancel" },
    ]);

  const t = c.tokens;
  return (
    <View style={{ flex: 1, backgroundColor: glass ? c.tokens.skyBottom : c.bg }}>
      {glass ? (
        <View style={StyleSheet.absoluteFill} pointerEvents="none">
          <SkyCard height={height} bodyTop={headerHeight + 70} />
        </View>
      ) : null}
      <Stack.Screen
        options={{
          title: "",
          headerTransparent: glass,
          headerStyle: { backgroundColor: glass ? "transparent" : c.bg },
          headerRight: () => (
            <Pressable onPress={menu} hitSlop={10} style={styles.headerButton} accessibilityLabel="Page actions">
              <Icon name="ellipsis" size={22} color={c.text} />
            </Pressable>
          ),
        }}
      />
      {!page.alive && (
        <Pressable onPress={() => lumen.setPageAlive(page.id, true)} style={[styles.banner, { backgroundColor: c.hover }]}>
          <Icon name="archive-restore" size={18} color={c.muted} />
          <Text style={{ color: c.text, flex: 1 }}>This page is in the trash. Tap to restore.</Text>
        </Pressable>
      )}
      <PageEditor
        ref={editor}
        dom={{ style: { flex: 1, backgroundColor: "transparent" }, containerStyle: { flex: 1, marginTop: glass ? headerHeight : 0, backgroundColor: "transparent" } }}
        title={initial.title}
        icon={icon ? { name: icon.name, ...(iconColor(icon.color, c.dark) ? { color: iconColor(icon.color, c.dark)! } : {}) } : null}
        initialContent={initial.content}
        editable={!readOnly}
        remote={remote}
        dark={c.dark}
        colors={{
          // Over the sky the page is frosted glass, so the weather shows through while writing.
          bg: glass ? t.glass : c.bg,
          surface: t.surface,
          text: t.text,
          muted: t.muted,
          faint: t.faint,
          hover: t.hover,
          active: t.active,
          border: t.border,
          accent: t.accent,
          accentSoft: t.accentSoft,
          accentText: t.accentText,
          selection: t.selection,
          shadow: t.shadow,
        }}
        onSave={(doc) => session!.save(doc)}
        onRename={(title) => lumen.renamePage(id, title)}
        onIconPress={async () => setPicking(true)}
      />
      <IconSheet
        visible={picking}
        current={icon}
        onClose={() => setPicking(false)}
        onPick={(next) => {
          lumen.setPageIcon(page.id, next).catch(console.error);
          setPicking(false);
        }}
      />
    </View>
  );
}

function IconSheet(props: {
  visible: boolean;
  current: { name: string; color?: string | undefined } | null;
  onClose: () => void;
  onPick: (icon: { type: "icon"; name: string; color?: string } | null) => void;
}) {
  const { visible, current, onClose, onPick } = props;
  const c = useColors();
  const [color, setColor] = useState<IconColor>((current?.color as IconColor) ?? "default");
  const pick = (name: string, col = color) => onPick({ type: "icon", name, ...(col !== "default" ? { color: col } : {}) });
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={[styles.backdrop, { backgroundColor: c.scrim }]} onPress={onClose}>
        <Pressable style={[styles.sheet, { backgroundColor: c.surface }]} onPress={() => {}}>
          <View style={styles.swatches}>
            {ICON_COLORS.map((col) => (
              <Pressable
                key={col}
                onPress={() => {
                  setColor(col);
                  if (current) pick(current.name, col);
                }}
                style={[styles.swatch, { backgroundColor: col === "default" ? c.text : iconColor(col, c.dark) }]}
              >
                {col === color ? <Icon name="check" size={13} strokeWidth={2.6} color={c.dark ? "#111" : "#fff"} /> : null}
              </Pressable>
            ))}
          </View>
          <FlatList
            data={PAGE_ICON_NAMES as readonly string[]}
            numColumns={6}
            keyExtractor={(n) => n}
            style={{ maxHeight: 330 }}
            renderItem={({ item }) => (
              <Pressable style={[styles.iconCell, current?.name === item && { backgroundColor: c.hover }]} onPress={() => pick(item)}>
                <Icon name={item as never} size={24} color={iconColor(color, c.dark) ?? c.text} />
              </Pressable>
            )}
          />
          {current ? (
            <Pressable style={styles.remove} onPress={() => onPick(null)}>
              <Text style={{ color: c.muted }}>Remove icon</Text>
            </Pressable>
          ) : null}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  headerButton: { width: 36, height: 36, alignItems: "center", justifyContent: "center" },
  banner: { flexDirection: "row", alignItems: "center", gap: 10, marginHorizontal: 14, marginVertical: 8, paddingHorizontal: 14, paddingVertical: 12, borderRadius: 14 },
  backdrop: { flex: 1, justifyContent: "flex-end" },
  sheet: { borderTopLeftRadius: 26, borderTopRightRadius: 26, padding: 14, paddingBottom: 26 },
  swatches: { flexDirection: "row", flexWrap: "wrap", gap: 8, paddingHorizontal: 4, paddingBottom: 12 },
  swatch: { width: 26, height: 26, borderRadius: 13, alignItems: "center", justifyContent: "center" },
  iconCell: { flex: 1, aspectRatio: 1, alignItems: "center", justifyContent: "center", borderRadius: 14 },
  remove: { alignItems: "center", paddingTop: 14 },
});
