import { useEffect, useState } from "react";
import { Alert, AppState, FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { canEdit } from "@lumen/shared";
import { pageTitle, type PageNode } from "@lumen/shared/client";
import type { Space } from "@lumen/shared/schema/client";
import { moodOf, textOnSky, type ClockFormat } from "@lumen/shared/ambient";
import type { IconName } from "@lumen/shared/icons";
import { lumen } from "../db/lumen";
import { useAccount, useLive } from "../data/hooks";
import { PageRow } from "../components/PageRow";
import { Icon } from "../components/Icon";
import { SkyCard } from "../ambient/SkyCard";
import { weatherIcon } from "../ambient/weatherIcon";
import { useAmbient } from "../ambient/AmbientProvider";
import { FONTS, useColors } from "../theme";

interface Row {
  node: PageNode;
  depth: number;
  /** Can add and remove pages here. */
  editable: boolean;
  /** First row of "Shared with me". */
  sharedStart?: boolean;
}

const flatten = (nodes: PageNode[], open: Set<string>, editable: boolean, depth = 0): Row[] =>
  nodes.flatMap((node) => [{ node, depth, editable }, ...(open.has(node.page.id) ? flatten(node.children, open, editable, depth + 1) : [])]);

async function newPage(parentId: string | null, spaceId?: string) {
  // A page inside a shared page belongs to that page's workspace, which may not be on this phone.
  const space = spaceId ? ({ id: spaceId } as Space) : await lumen.getSpace();
  if (!space) return;
  const id = await lumen.createPage(space, parentId);
  router.push(`/page/${id}`);
}

function timeParts(date: Date, format: ClockFormat) {
  const opts: Intl.DateTimeFormatOptions = { hour: "numeric", minute: "2-digit" };
  if (format === "12h") opts.hour12 = true;
  if (format === "24h") opts.hourCycle = "h23";
  const parts = new Intl.DateTimeFormat(undefined, opts).formatToParts(date);
  return {
    time: parts.filter((p) => p.type !== "dayPeriod").map((p) => p.value).join("").trim(),
    period: parts.find((p) => p.type === "dayPeriod")?.value,
  };
}

const greeting = (h: number) => (h < 5 ? "Good night" : h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : h < 21 ? "Good evening" : "Good night");

/** The time, updated right as each minute turns and when the app comes back to the front. */
function useNow() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const tick = () => {
      setNow(new Date());
      timer = setTimeout(tick, 60_000 - (Date.now() % 60_000) + 20);
    };
    timer = setTimeout(tick, 60_000 - (Date.now() % 60_000) + 20);
    const sub = AppState.addEventListener("change", (s) => s === "active" && setNow(new Date()));
    return () => {
      clearTimeout(timer);
      sub.remove();
    };
  }, []);
  return now;
}

function SkyHeader() {
  const { sky, theme, settings } = useAmbient();
  const insets = useSafeAreaInsets();
  const now = useNow();
  const role = useLive(async () => {
    const space = await lumen.getSpace();
    return (await lumen.listSpaces()).find((s) => s.space.id === space?.id)?.role;
  }, []);
  const ink = textOnSky(theme.skyMid, theme.dark);
  const { time, period } = timeParts(now, settings.clock);
  const temp =
    sky.temperature === undefined ? undefined : `${Math.round(settings.temperatureUnit === "f" ? sky.temperature * 1.8 + 32 : sky.temperature)}°`;
  const line = sky.live ? [sky.label, temp].filter(Boolean).join(" · ") : (moodOf(settings)?.name ?? "Custom sky");
  const sub = sky.live ? (settings.location?.label ?? "Live sky") : "Mood";

  return (
    <SkyCard height={insets.top + 250} bodyTop={insets.top + 112}>
      <View style={[styles.topRow, { paddingTop: insets.top + 6 }]}>
        <Text style={[styles.brand, { color: ink }]}>Lumen</Text>
        <View style={{ flexDirection: "row", gap: 8 }}>
          <RoundButton icon="search" ink={ink} onPress={() => router.push("/search")} label="Search" />
          {role === "viewer" ? null : <RoundButton icon="plus" ink={ink} onPress={() => newPage(null)} label="New page" />}
          <RoundButton icon="settings" ink={ink} onPress={() => router.push("/settings")} label="Settings" />
        </View>
      </View>
      <View style={styles.clock}>
        <Text style={[styles.greeting, { color: ink, opacity: 0.75 }]}>{greeting(now.getHours()).toUpperCase()}</Text>
        <View style={{ flexDirection: "row", alignItems: "baseline", gap: 6 }}>
          <Text style={[styles.time, { color: ink }]}>{time}</Text>
          {period ? <Text style={[styles.period, { color: ink, opacity: 0.7 }]}>{period}</Text> : null}
        </View>
        <Text style={{ color: ink, opacity: 0.75, fontSize: 14 }}>{now.toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long" })}</Text>
        <Pressable onPress={() => router.push("/settings")} style={[styles.weather, { backgroundColor: "rgba(0,0,0,0.16)" }]}>
          <Icon name={weatherIcon(sky.precip, sky.storm, sky.fog, sky.clouds, sky.daylight > 0.4)} size={17} color="#fff" />
          <Text numberOfLines={1} style={{ color: "#fff", fontSize: 13.5 }}>
            {line}
            <Text style={{ opacity: 0.75 }}> · {sub}</Text>
          </Text>
        </Pressable>
      </View>
    </SkyCard>
  );
}

/** Signed out: a gentle nudge (now and then, after "Later") to sign in and sync. */
function AccountCard() {
  const c = useColors();
  const { user, reminderDue, skipped, available } = useAccount();
  if (!available || user || !(reminderDue || !skipped)) return null;
  return (
    <View style={[styles.card, { backgroundColor: c.accentSoft }]}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
        <Icon name="cloud" size={17} color={c.accent} />
        <Text style={{ color: c.text, fontSize: 15, fontWeight: "600" }}>{skipped ? "Keep your notes safe" : "You're signed out"}</Text>
      </View>
      <Text style={{ color: c.muted, fontSize: 13.5, lineHeight: 19, marginTop: 4 }}>
        {skipped ? "Sign in to sync your notes to your other devices and share pages." : "Sign in again to keep syncing."}
      </Text>
      <View style={{ flexDirection: "row", gap: 8, marginTop: 10 }}>
        <Pressable onPress={() => router.push("/signin")} style={[styles.cardButton, { backgroundColor: c.accent }]}>
          <Text style={{ color: c.accentText, fontWeight: "600" }}>Sign in</Text>
        </Pressable>
        {skipped ? (
          <Pressable onPress={() => lumen.account.snoozeReminder()} style={styles.cardButton}>
            <Text style={{ color: c.muted }}>Not now</Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

function RoundButton({ icon, ink, onPress, label }: { icon: IconName; ink: string; onPress: () => void; label: string }) {
  return (
    <Pressable onPress={onPress} hitSlop={6} accessibilityLabel={label} style={({ pressed }) => [styles.round, { backgroundColor: pressed ? "rgba(0,0,0,0.28)" : "rgba(0,0,0,0.16)" }]}>
      <Icon name={icon} size={19} color={ink} />
    </Pressable>
  );
}

export default function Home() {
  const c = useColors();
  // Bumped when the workspace is switched (a phone-local choice, not a data change).
  const [picked, setPicked] = useState(0);
  const data = useLive(async () => {
    const space = await lumen.getSpace();
    const spaces = await lumen.listSpaces();
    const shared = await lumen.sharedPages();
    return {
      space,
      spaces,
      role: spaces.find((s) => s.space.id === space?.id)?.role,
      tree: space ? await lumen.pageTree(space) : [],
      // pageTree only reads `pages`, so shared pages make a little tree of their own.
      shared: (await lumen.pageTree({ pages: shared.map((s) => s.page.id) } as Space)).map((node) => ({
        node,
        role: shared.find((s) => s.page.id === node.page.id)?.role,
      })),
    };
  }, [picked]);
  const tree = data?.tree;
  const trashCount = useLive(async () => (await lumen.trashedPages()).length, []) ?? 0;
  const [open, setOpen] = useState<Set<string>>(new Set());

  const toggle = (id: string) =>
    setOpen((prev) => {
      const next = new Set(prev);
      if (!next.delete(id)) next.add(id);
      return next;
    });

  const actions = (node: PageNode) =>
    Alert.alert(pageTitle(node.page), undefined, [
      { text: "Add sub-page", onPress: () => newPage(node.page.id, node.page.space_id).then(() => setOpen((p) => new Set(p).add(node.page.id))) },
      { text: "Move to trash", style: "destructive", onPress: () => lumen.setPageAlive(node.page.id, false) },
      { text: "Cancel", style: "cancel" },
    ]);

  return (
    <View style={{ flex: 1, backgroundColor: c.tokens.skyBottom }}>
      <SkyHeader />
      <View style={[styles.sheet, { backgroundColor: c.bg, shadowColor: "#000" }]}>
        <FlatList
          data={
            data
              ? [
                  ...flatten(data.tree, open, canEdit(data.role)),
                  ...data.shared.flatMap(({ node, role }, i) =>
                    flatten([node], open, canEdit(role)).map((r, j) => ({ ...r, sharedStart: i === 0 && j === 0 })),
                  ),
                ]
              : []
          }
          keyExtractor={(r) => r.node.page.id}
          contentContainerStyle={{ paddingHorizontal: 8, paddingTop: 10, paddingBottom: 40 }}
          ListHeaderComponent={
            <>
              <AccountCard />
              {data && data.spaces.length > 1 && data.space ? (
                <Pressable
                  onPress={() =>
                    Alert.alert("Workspaces", undefined, [
                      ...data.spaces.map((s) => ({
                        text: `${s.space.id === data.space?.id ? "✓ " : ""}${s.space.name}${s.role === "owner" ? "" : s.role === "editor" ? " · can edit" : " · can view"}`,
                        onPress: () => void lumen.setCurrentSpace(s.space.id).then(() => setPicked((n) => n + 1)),
                      })),
                      { text: "Cancel", style: "cancel" },
                    ])
                  }
                  style={styles.spaceRow}
                >
                  <Text style={{ color: c.text, fontSize: 16, fontWeight: "600" }} numberOfLines={1}>
                    {data.space.name}
                  </Text>
                  <Icon name="chevrons-up-down" size={15} color={c.faint} />
                </Pressable>
              ) : null}
              <Text style={[styles.section, { color: c.faint }]}>PAGES</Text>
            </>
          }
          renderItem={({ item: { node, depth, editable, sharedStart } }) => (
            <>
            {sharedStart ? <Text style={[styles.section, { color: c.faint, marginTop: 14 }]}>SHARED WITH ME</Text> : null}
            <PageRow
              page={node.page}
              depth={depth}
              expanded={open.has(node.page.id)}
              hasChildren={node.children.length > 0}
              onToggle={() => toggle(node.page.id)}
              onPress={() => router.push(`/page/${node.page.id}`)}
              onLongPress={editable ? () => actions(node) : undefined}
            />
            </>
          )}
          ListEmptyComponent={tree ? <Text style={{ color: c.muted, padding: 24, textAlign: "center" }}>No pages yet. Tap + to start one.</Text> : undefined}
          ListFooterComponent={
            <Pressable onPress={() => router.push("/trash")} android_ripple={{ color: c.hover }} style={styles.trash}>
              <Icon name="trash" size={18} color={c.muted} />
              <Text style={{ color: c.muted, fontSize: 15 }}>Trash{trashCount ? ` · ${trashCount}` : ""}</Text>
            </Pressable>
          }
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  topRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 18 },
  brand: { fontFamily: FONTS.serif, fontSize: 20, letterSpacing: -0.2 },
  round: { width: 38, height: 38, borderRadius: 19, alignItems: "center", justifyContent: "center" },
  clock: { paddingHorizontal: 20, paddingTop: 18 },
  greeting: { fontSize: 11.5, letterSpacing: 1.6, fontWeight: "600" },
  time: { fontFamily: FONTS.serifLight, fontSize: 62, lineHeight: 70, letterSpacing: -1 },
  period: { fontFamily: FONTS.serifLight, fontSize: 20 },
  weather: { flexDirection: "row", alignItems: "center", gap: 8, alignSelf: "flex-start", marginTop: 12, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 14, maxWidth: "100%" },
  sheet: { flex: 1, marginTop: -26, borderTopLeftRadius: 28, borderTopRightRadius: 28, overflow: "hidden", elevation: 12 },
  section: { fontSize: 11, letterSpacing: 1.5, fontWeight: "600", paddingHorizontal: 12, paddingTop: 8, paddingBottom: 6 },
  spaceRow: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 12, paddingTop: 6 },
  card: { borderRadius: 18, padding: 14, marginHorizontal: 4, marginBottom: 8 },
  cardButton: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 12 },
  trash: { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 14, paddingVertical: 14, marginTop: 10, borderRadius: 14 },
});
