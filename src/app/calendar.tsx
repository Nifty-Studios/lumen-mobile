// The calendar on the phone: a month of days. Pick a sticker from the tray and tap a day to
// put it there (then fill in the details), or tap a day to see what's on.

import { useEffect, useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
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
        <Text style={{ fontFamily: FONTS.serif, fontSize: 26, color: c.text, flex: 1 }}>{parseYmd(month).toLocaleDateString(undefined, { month: "long", year: "numeric" })}</Text>
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
        <>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 12, gap: 6 }}>
            {STICKERS.map((s) => (
              <Pressable key={s.id} onPress={() => setArmed(armed === s.id ? null : s.id)} style={[styles.trayItem, armed === s.id ? { backgroundColor: c.accentSoft } : null]}>
                <StickerBadge sticker={s.id} size={34} />
              </Pressable>
            ))}
          </ScrollView>
          <Text style={{ color: armed ? c.accent : c.faint, fontSize: 12.5, paddingHorizontal: 18, paddingTop: 6 }}>
            {armed ? `Now tap a day to put “${stickerOf(armed).label}” on it` : "Pick a sticker, then tap a day"}
          </Text>
        </>
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
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 18, paddingTop: 8, paddingBottom: 12 },
  nav: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" },
  todayBtn: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 12 },
  trayItem: { padding: 3, borderRadius: 20 },
  day: { flex: 1, height: 62, margin: 1.5, borderRadius: 12, alignItems: "center", paddingTop: 4 },
  num: { minWidth: 26, height: 26, borderRadius: 13, alignItems: "center", justifyContent: "center", paddingHorizontal: 4 },
  dots: { flexDirection: "row", gap: 1, marginTop: 3 },
  sectionRow: { flexDirection: "row", alignItems: "center", paddingRight: 10 },
  section: { fontSize: 11, letterSpacing: 1.5, fontWeight: "600", paddingHorizontal: 12, paddingTop: 8, paddingBottom: 6 },
  add: { flexDirection: "row", alignItems: "center", gap: 4 },
  agenda: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 12, paddingVertical: 9, borderRadius: 14 },
});
