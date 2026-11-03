// The calendar on the phone: a month of days. Pick a sticker from the box and tap a day to
// put it there (then fill in the details), or tap a day to see what's on.

import { useEffect, useMemo, useState } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { canEdit } from "@lumen/shared";
import { STICKERS, addDays, parseYmd, stickerOf, today as todayYmd, ymd, type Occurrence } from "@lumen/shared/calendar";
import { lumen } from "../db/lumen";
import { useLive } from "../data/hooks";
import { useAmbient } from "../ambient/AmbientProvider";
import { Icon } from "../components/Icon";
import { StickerBadge, formatHm } from "../components/Sticker";
import { FONTS, useColors } from "../theme";

function weekStart(): number {
  try {
    const loc = new Intl.Locale(Intl.DateTimeFormat().resolvedOptions().locale) as Intl.Locale & { getWeekInfo?: () => { firstDay: number }; weekInfo?: { firstDay: number } };
    return (loc.getWeekInfo?.().firstDay ?? loc.weekInfo?.firstDay ?? 1) % 7;
  } catch {
    return 1;
  }
}

/** Re-renders when the birthday or settings change (they aren't records). */
export function useCalendarVersion() {
  const [v, setV] = useState(0);
  useEffect(() => {
    const a = lumen.profile.onChange(() => setV((n) => n + 1));
    const b = lumen.onSettings(() => setV((n) => n + 1));
    return () => {
      a();
      b();
    };
  }, []);
  return v;
}

export default function CalendarScreen() {
  const c = useColors();
  const { settings } = useAmbient();
  const params = useLocalSearchParams<{ date?: string }>();
  const [selected, setSelected] = useState(() => params.date ?? todayYmd());
  const [month, setMonth] = useState(() => (params.date ?? todayYmd()).slice(0, 8) + "01");
  const [armed, setArmed] = useState<string | null>(null);
  const [picking, setPicking] = useState(false);
  const version = useCalendarVersion();
  const first = useMemo(weekStart, []);
  const today = todayYmd();

  useEffect(() => {
    if (!params.date) return;
    setSelected(params.date);
    setMonth(params.date.slice(0, 8) + "01");
  }, [params.date]);

  const gridStart = useMemo(() => addDays(month, -((parseYmd(month).getDay() - first + 7) % 7)), [month, first]);
  const occurrences = useLive(() => lumen.calendar.between(gridStart, addDays(gridStart, 41 + 30)), [gridStart, version]) ?? [];
  const byDay = useMemo(() => {
    const map = new Map<string, Occurrence[]>();
    for (const o of occurrences) map.set(o.date, [...(map.get(o.date) ?? []), o]);
    return map;
  }, [occurrences]);
  const home = useLive(async () => {
    const space = await lumen.getSpace();
    const spaces = await lumen.listSpaces();
    const here = spaces.find((s) => s.space.id === space?.id);
    return (here && canEdit(here.role) ? here : spaces.find((s) => canEdit(s.role)))?.space.id ?? null;
  }, []);

  const shift = (n: number) => {
    const d = parseYmd(month);
    d.setMonth(d.getMonth() + n);
    setMonth(ymd(d));
  };

  const tapDay = async (date: string) => {
    setSelected(date);
    if (!armed || !home) return;
    const sticker = armed;
    setArmed(null);
    const id = await lumen.calendar.createEvent(home, { date, sticker, title: stickerOf(sticker).label });
    router.push({ pathname: "/event", params: { id, date } });
  };

  const list = byDay.get(selected) ?? [];
  const upcoming = occurrences.filter((o) => o.date > selected && o.date <= addDays(selected, 30)).slice(0, 10);
  const weekdays = Array.from({ length: 7 }, (_, i) => parseYmd(addDays(gridStart, i)).toLocaleDateString(undefined, { weekday: "narrow" }));

  const row = (o: Occurrence, showDate = false) => (
    <Pressable key={o.event.id + o.date} android_ripple={{ color: c.hover }} onPress={() => router.push({ pathname: "/event", params: { id: o.event.id, date: o.date } })} style={styles.agenda}>
      <StickerBadge sticker={o.event.sticker} size={34} />
      <View style={{ flex: 1 }}>
        <Text style={{ color: c.text, fontSize: 15.5 }} numberOfLines={1}>
          {o.event.title || "Untitled"}
        </Text>
        <Text style={{ color: c.faint, fontSize: 13 }} numberOfLines={1}>
          {[showDate && parseYmd(o.date).toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" }), o.event.time ? formatHm(o.event.time, settings.clock) : "All day"].filter(Boolean).join(" · ")}
        </Text>
      </View>
      {o.event.celebrate ? <Icon name="sparkles" size={16} color={c.accent} /> : null}
    </Pressable>
  );

  return (
    <ScrollView style={{ flex: 1, backgroundColor: c.bg }} contentContainerStyle={{ paddingBottom: 40 }}>
      <View style={styles.header}>
        <Pressable onPress={() => setPicking(true)} hitSlop={6} style={styles.title} accessibilityLabel="Pick a month and year">
          <Text style={{ fontFamily: FONTS.serif, fontSize: 26, color: c.text }} numberOfLines={1}>
            {parseYmd(month).toLocaleDateString(undefined, { month: "long", year: "numeric" })}
          </Text>
          <Icon name="chevron-down" size={18} color={c.faint} />
        </Pressable>
        <Pressable hitSlop={8} onPress={() => shift(-1)} style={styles.nav}>
          <Icon name="chevron-left" size={20} color={c.muted} />
        </Pressable>
        <Pressable
          hitSlop={6}
          onPress={() => {
            setMonth(today.slice(0, 8) + "01");
            setSelected(today);
          }}
          style={[styles.todayBtn, { backgroundColor: c.hover }]}
        >
          <Text style={{ color: c.text, fontSize: 13.5 }}>Today</Text>
        </Pressable>
        <Pressable hitSlop={8} onPress={() => shift(1)} style={styles.nav}>
          <Icon name="chevron-right" size={20} color={c.muted} />
        </Pressable>
      </View>

      {home ? (
        <View style={[styles.box, { backgroundColor: c.hover }]}>
          <View style={styles.boxHead}>
            <Text style={[styles.boxTitle, { color: c.faint }]}>STICKERS</Text>
            <Text style={{ color: armed ? c.accent : c.faint, fontSize: 12.5, flexShrink: 1, textAlign: "right" }} numberOfLines={1}>
              {armed ? `Tap a day for “${stickerOf(armed).label}”` : "Pick one, then tap a day"}
            </Text>
          </View>
          <View style={styles.grid}>
            {STICKERS.map((s) => (
              <Pressable key={s.id} onPress={() => setArmed(armed === s.id ? null : s.id)} style={[styles.cell, armed === s.id ? { backgroundColor: c.accentSoft } : null]}>
                <StickerBadge sticker={s.id} size={34} />
                <Text style={{ color: armed === s.id ? c.accent : c.muted, fontSize: 10.5, marginTop: 3 }} numberOfLines={1}>
                  {s.label}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>
      ) : null}

      <View style={{ paddingHorizontal: 10, paddingTop: 10 }}>
        <View style={{ flexDirection: "row" }}>
          {weekdays.map((w, i) => (
            <Text key={i} style={{ flex: 1, textAlign: "center", color: c.faint, fontSize: 12, fontWeight: "600", paddingBottom: 4 }}>
              {w}
            </Text>
          ))}
        </View>
        {Array.from({ length: 6 }, (_, week) => (
          <View key={week} style={{ flexDirection: "row" }}>
            {Array.from({ length: 7 }, (_, d) => {
              const date = addDays(gridStart, week * 7 + d);
              const items = byDay.get(date) ?? [];
              const isSel = date === selected;
              const isToday = date === today;
              return (
                <Pressable key={date} onPress={() => void tapDay(date)} style={[styles.day, { backgroundColor: isSel ? c.active : armed ? c.hover : "transparent", opacity: date.slice(0, 7) === month.slice(0, 7) ? 1 : 0.4 }]}>
                  <View style={[styles.num, isToday ? { backgroundColor: c.accent } : null]}>
                    <Text style={{ color: isToday ? c.accentText : c.text, fontSize: 13.5, fontWeight: isToday ? "700" : "400" }}>{parseYmd(date).getDate()}</Text>
                  </View>
                  <View style={styles.dots}>
                    {items.slice(0, 3).map((o) => (
                      <StickerBadge key={o.event.id} sticker={o.event.sticker} size={15} />
                    ))}
                  </View>
                  {items.length > 3 ? <Text style={{ color: c.faint, fontSize: 9.5 }}>+{items.length - 3}</Text> : null}
                </Pressable>
              );
            })}
          </View>
        ))}
      </View>

      <View style={{ paddingHorizontal: 10, paddingTop: 14 }}>
        <View style={styles.sectionRow}>
          <Text style={[styles.section, { color: c.faint, flex: 1 }]}>
            {(selected === today ? "Today" : parseYmd(selected).toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long" })).toUpperCase()}
          </Text>
          {home ? (
            <Pressable hitSlop={8} onPress={() => router.push({ pathname: "/event", params: { date: selected } })} style={styles.add}>
              <Icon name="plus" size={16} color={c.accent} />
              <Text style={{ color: c.accent, fontSize: 14 }}>Add</Text>
            </Pressable>
          ) : null}
        </View>
        {list.length ? list.map((o) => row(o)) : <Text style={{ color: c.muted, fontSize: 14.5, paddingHorizontal: 12, paddingVertical: 8 }}>Nothing planned.</Text>}
        {upcoming.length ? (
          <>
            <Text style={[styles.section, { color: c.faint, marginTop: 14 }]}>COMING UP</Text>
            {upcoming.map((o) => row(o, true))}
          </>
        ) : null}
      </View>
      <MonthPicker
        visible={picking}
        month={month}
        today={today}
        onPick={(m) => {
          setMonth(m);
          setSelected(m.slice(0, 7) === today.slice(0, 7) ? today : m);
        }}
        onClose={() => setPicking(false)}
      />
    </ScrollView>
  );
}

/** Jump anywhere: step through years, pick a month, or go back to today. */
function MonthPicker({ visible, month, today, onPick, onClose }: { visible: boolean; month: string; today: string; onPick: (m: string) => void; onClose: () => void }) {
  const c = useColors();
  const [year, setYear] = useState(Number(month.slice(0, 4)));
  useEffect(() => {
    if (visible) setYear(Number(month.slice(0, 4)));
  }, [visible, month]);
  const names = Array.from({ length: 12 }, (_, i) => new Date(2000, i, 1).toLocaleDateString(undefined, { month: "short" }));
  const go = (m: string) => {
    onPick(m);
    onClose();
  };
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={[styles.backdrop, { backgroundColor: c.scrim }]} onPress={onClose}>
        <Pressable style={[styles.picker, { backgroundColor: c.surface }]} onPress={() => {}}>
          <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 10 }}>
            <Pressable hitSlop={10} onPress={() => setYear((y) => y - 1)} style={styles.nav}>
              <Icon name="chevron-left" size={22} color={c.muted} />
            </Pressable>
            <Text style={{ flex: 1, textAlign: "center", fontFamily: FONTS.serif, fontSize: 24, color: c.text }}>{year}</Text>
            <Pressable hitSlop={10} onPress={() => setYear((y) => y + 1)} style={styles.nav}>
              <Icon name="chevron-right" size={22} color={c.muted} />
            </Pressable>
          </View>
          <View style={{ flexDirection: "row", flexWrap: "wrap" }}>
            {names.map((name, i) => {
              const key = `${year}-${String(i + 1).padStart(2, "0")}`;
              const current = key === month.slice(0, 7);
              const now = key === today.slice(0, 7);
              return (
                <View key={name} style={{ width: "33.33%", padding: 3 }}>
                  <Pressable onPress={() => go(`${key}-01`)} style={[styles.month, { backgroundColor: current ? c.accent : now ? c.accentSoft : c.hover }]}>
                    <Text style={{ color: current ? c.accentText : now ? c.accent : c.text, fontSize: 15, fontWeight: current ? "600" : "400" }}>{name}</Text>
                  </Pressable>
                </View>
              );
            })}
          </View>
          <Pressable onPress={() => go(today.slice(0, 8) + "01")} style={styles.backToday}>
            <Icon name="calendar-days" size={16} color={c.accent} />
            <Text style={{ color: c.accent, fontSize: 15 }}>Back to today</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 18, paddingTop: 8, paddingBottom: 12 },
  nav: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" },
  todayBtn: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 12 },
  title: { flex: 1, flexDirection: "row", alignItems: "center", gap: 4 },
  box: { marginHorizontal: 12, borderRadius: 18, padding: 10 },
  boxHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8, paddingHorizontal: 4, paddingBottom: 6 },
  boxTitle: { fontSize: 11, letterSpacing: 1.5, fontWeight: "600" },
  grid: { flexDirection: "row", flexWrap: "wrap" },
  cell: { width: "20%", alignItems: "center", paddingVertical: 6, borderRadius: 14 },
  backdrop: { flex: 1, justifyContent: "center", padding: 24 },
  picker: { borderRadius: 24, padding: 16, elevation: 12 },
  month: { height: 46, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  backToday: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, marginTop: 10, paddingVertical: 10 },
  day: { flex: 1, height: 62, margin: 1.5, borderRadius: 12, alignItems: "center", paddingTop: 4 },
  num: { minWidth: 26, height: 26, borderRadius: 13, alignItems: "center", justifyContent: "center", paddingHorizontal: 4 },
  dots: { flexDirection: "row", gap: 1, marginTop: 3 },
  sectionRow: { flexDirection: "row", alignItems: "center", paddingRight: 10 },
  section: { fontSize: 11, letterSpacing: 1.5, fontWeight: "600", paddingHorizontal: 12, paddingTop: 8, paddingBottom: 6 },
  add: { flexDirection: "row", alignItems: "center", gap: 4 },
  agenda: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 12, paddingVertical: 9, borderRadius: 14 },
});
