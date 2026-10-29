import { useEffect, useState } from "react";
import { Alert, FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { pageTitle, type PageNode } from "@lumen/shared/client";
import { moodOf, textOnSky, type ClockFormat } from "@lumen/shared/ambient";
import type { IconName } from "@lumen/shared/icons";
import { lumen } from "../db/lumen";
import { useLive } from "../data/hooks";
import { PageRow } from "../components/PageRow";
import { Icon } from "../components/Icon";
import { SkyCard } from "../ambient/SkyCard";
import { weatherIcon } from "../ambient/weatherIcon";
import { useAmbient } from "../ambient/AmbientProvider";
import { FONTS, useColors } from "../theme";

interface Row {
  node: PageNode;
  depth: number;
}

const flatten = (nodes: PageNode[], open: Set<string>, depth = 0): Row[] =>
  nodes.flatMap((node) => [{ node, depth }, ...(open.has(node.page.id) ? flatten(node.children, open, depth + 1) : [])]);

async function newPage(parentId: string | null) {
  const space = await lumen.getSpace();
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

function useNow() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 15_000);
    return () => clearInterval(t);
  }, []);
  return now;
}

function SkyHeader() {
  const { sky, theme, settings } = useAmbient();
  const insets = useSafeAreaInsets();
  const now = useNow();
  const ink = textOnSky(theme.skyMid, theme.dark);
  const { time, period } = timeParts(now, settings.clock);
  const temp =
    sky.temperature === undefined ? undefined : `${Math.round(settings.temperatureUnit === "f" ? sky.temperature * 1.8 + 32 : sky.temperature)}°`;
  const line = sky.live ? [sky.label, temp].filter(Boolean).join(" · ") : (moodOf(settings)?.name ?? "Custom sky");
  const sub = sky.live ? (settings.location?.label ?? "Live sky") : "Mood";

  return (
    <SkyCard height={insets.top + 250}>
      <View style={[styles.topRow, { paddingTop: insets.top + 6 }]}>
        <Text style={[styles.brand, { color: ink }]}>Lumen</Text>
        <View style={{ flexDirection: "row", gap: 8 }}>
          <RoundButton icon="search" ink={ink} onPress={() => router.push("/search")} label="Search" />
          <RoundButton icon="plus" ink={ink} onPress={() => newPage(null)} label="New page" />
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

function RoundButton({ icon, ink, onPress, label }: { icon: IconName; ink: string; onPress: () => void; label: string }) {
  return (
    <Pressable onPress={onPress} hitSlop={6} accessibilityLabel={label} style={({ pressed }) => [styles.round, { backgroundColor: pressed ? "rgba(0,0,0,0.28)" : "rgba(0,0,0,0.16)" }]}>
      <Icon name={icon} size={19} color={ink} />
    </Pressable>
  );
}

export default function Home() {
  const c = useColors();
  const tree = useLive(async () => {
    const space = await lumen.getSpace();
    return space ? lumen.pageTree(space) : [];
  }, []);
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
      { text: "Add sub-page", onPress: () => newPage(node.page.id).then(() => setOpen((p) => new Set(p).add(node.page.id))) },
      { text: "Move to trash", style: "destructive", onPress: () => lumen.setPageAlive(node.page.id, false) },
      { text: "Cancel", style: "cancel" },
    ]);

  return (
    <View style={{ flex: 1, backgroundColor: c.tokens.skyBottom }}>
      <SkyHeader />
      <View style={[styles.sheet, { backgroundColor: c.bg, shadowColor: "#000" }]}>
        <FlatList
          data={tree ? flatten(tree, open) : []}
          keyExtractor={(r) => r.node.page.id}
          contentContainerStyle={{ paddingHorizontal: 8, paddingTop: 10, paddingBottom: 40 }}
          ListHeaderComponent={<Text style={[styles.section, { color: c.faint }]}>PAGES</Text>}
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
  trash: { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 14, paddingVertical: 14, marginTop: 10, borderRadius: 14 },
});
