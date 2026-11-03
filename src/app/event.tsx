// One event: what, when, how often, when to be reminded, and whether the sky celebrates it.
// Holidays and the birthday open read-only, with a preview of their sky.

import { useEffect, useLayoutEffect, useState, type ReactNode } from "react";
import { Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from "react-native";
import { router, useLocalSearchParams, useNavigation } from "expo-router";
import { DateTimePickerAndroid } from "@react-native-community/datetimepicker";
import { canEdit } from "@lumen/shared";
import {
  ALL_DAY_REMINDER_OPTIONS,
  CELEBRATIONS,
  CELEBRATION_IDS,
  REMINDER_OPTIONS,
  REPEAT_OPTIONS,
  STICKERS,
  ageOn,
  parseYmd,
  reminderLabel,
  stickerOf,
  ymd,
  type CalendarEvent,
} from "@lumen/shared/calendar";
import { lumen } from "../db/lumen";
import { useAmbient } from "../ambient/AmbientProvider";
import { Icon } from "../components/Icon";
import { ChoiceSheet, NameDialog, type Choice } from "../components/Sheets";
import { StickerBadge, formatHm } from "../components/Sticker";
import { FONTS, useColors } from "../theme";

type Draft = Omit<CalendarEvent, "id" | "spaceId">;

const hm = (d: Date) => `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
const longDate = (s: string) => parseYmd(s).toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long", year: "numeric" });

/** "45 minutes", "3 hours", "2 days", "1 week" (or a bare number of minutes). */
function parseOffset(text: string): number | undefined {
  const m = text.trim().toLowerCase().match(/^(\d+)\s*(m|min|mins|minutes?|h|hrs?|hours?|d|days?|w|weeks?)?/);
  if (!m) return undefined;
  const n = Number(m[1]);
  const u = m[2] ?? "m";
  return n * (u.startsWith("w") ? 10080 : u.startsWith("d") ? 1440 : u.startsWith("h") ? 60 : 1);
}

export default function EventScreen() {
  const c = useColors();
  const { settings, preview } = useAmbient();
  const navigation = useNavigation();
  const params = useLocalSearchParams<{ id?: string; date?: string; sticker?: string }>();
  const id = params.id;
  const [loaded, setLoaded] = useState<CalendarEvent | null | undefined>(id ? undefined : null);
  const [home, setHome] = useState<string | null>();
  const [draft, setDraft] = useState<Draft>({
    title: "",
    date: params.date ?? ymd(new Date()),
    time: null,
    endTime: null,
    repeat: "none",
    until: null,
    reminders: [0],
    sticker: params.sticker ?? STICKERS[0]!.id,
    notes: "",
    celebrate: null,
  });
  const [sheet, setSheet] = useState<{ title: string; choices: Choice[] }>();
  const [customOpen, setCustomOpen] = useState<string>();

  useEffect(() => {
    if (id)
      lumen.calendar.getEvent(id).then((e) => {
        setLoaded(e ?? null);
        if (e) setDraft(e);
      }, console.warn);
    (async () => {
      const space = await lumen.getSpace();
      const spaces = await lumen.listSpaces();
      const here = spaces.find((s) => s.space.id === space?.id);
      setHome((here && canEdit(here.role) ? here : spaces.find((s) => canEdit(s.role)))?.space.id ?? null);
    })();
  }, [id]);

  const builtin = loaded?.builtin;
  const readOnly = !!builtin || (loaded ? !loaded.editable : !home);
  useLayoutEffect(() => navigation.setOptions({ title: builtin ? "" : id ? (readOnly ? "Event" : "Edit event") : "New event" }), [navigation, id, builtin, readOnly]);

  if (id && loaded === undefined) return <View style={{ flex: 1, backgroundColor: c.bg }} />;
  if (id && loaded === null)
    return (
      <View style={{ flex: 1, backgroundColor: c.bg, padding: 24 }}>
        <Text style={{ color: c.muted }}>This event was deleted.</Text>
      </View>
    );

  const set = (patch: Partial<Draft>) => setDraft((d) => ({ ...d, ...patch }));
  const allDay = draft.time === null;

  const save = async () => {
    const input = { ...draft, title: draft.title.trim() };
    if (id) await lumen.calendar.updateEvent(id, input);
    else if (home) await lumen.calendar.createEvent(home, input);
    router.back();
  };

  const pickDate = (value: string, onPick: (v: string) => void) =>
    DateTimePickerAndroid.open({ value: parseYmd(value), mode: "date", onChange: (e, d) => e.type === "set" && d && onPick(ymd(d)) });
  const pickTime = (value: string | null, onPick: (v: string) => void) => {
    const base = new Date();
    if (value) base.setHours(Number(value.slice(0, 2)), Number(value.slice(3)), 0, 0);
    DateTimePickerAndroid.open({ value: base, mode: "time", is24Hour: settings.clock === "24h", onChange: (e, d) => e.type === "set" && d && onPick(hm(d)) });
  };

  if (builtin && loaded) {
    const celebration = loaded.celebrate ? CELEBRATIONS[loaded.celebrate] : undefined;
    const birthday = builtin === "birthday" ? lumen.profile.birthday() : null;
    const age = birthday ? ageOn(birthday, params.date ?? loaded.date) : undefined;
    return (
      <View style={{ flex: 1, backgroundColor: c.bg, padding: 22 }}>
        <StickerBadge sticker={loaded.sticker} size={56} />
        <Text style={{ fontFamily: FONTS.serif, fontSize: 28, color: c.text, marginTop: 14 }}>{loaded.title}</Text>
        <Text style={{ color: c.muted, fontSize: 14.5, marginTop: 2 }}>
          {longDate(params.date ?? loaded.date)}
          {age !== undefined && age > 0 ? ` · you turn ${age}` : ""}
        </Text>
        <Text style={{ color: c.muted, fontSize: 15, lineHeight: 22, marginTop: 16 }}>
          {builtin === "birthday"
            ? "Lumen celebrates with you all day: confetti and balloons in the sky, and a note in the morning."
            : `On the day the sky turns ${celebration?.name ?? "festive"}, and Lumen says hello in the morning.`}
        </Text>
        <View style={{ flexDirection: "row", gap: 10, marginTop: 22, flexWrap: "wrap" }}>
          {celebration ? (
            <Pressable
              onPress={() => {
                preview(celebration.id);
                router.dismissTo("/");
              }}
              style={[styles.button, { backgroundColor: c.accent }]}
            >
              <Icon name="sparkles" size={16} color={c.accentText} />
              <Text style={{ color: c.accentText, fontWeight: "600" }}>Preview the sky</Text>
            </Pressable>
          ) : null}
          <Pressable onPress={() => router.push("/settings")} style={[styles.button, { backgroundColor: c.hover }]}>
            <Icon name="settings" size={16} color={c.muted} />
            <Text style={{ color: c.text }}>{builtin === "birthday" ? "Change birthday" : "Holiday settings"}</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  const options = allDay ? ALL_DAY_REMINDER_OPTIONS : REMINDER_OPTIONS;

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <ScrollView contentContainerStyle={{ padding: 18, paddingBottom: 120 }} keyboardShouldPersistTaps="handled">
        <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
          <StickerBadge sticker={draft.sticker} size={46} />
          <TextInput
            value={draft.title}
            editable={!readOnly}
            autoFocus={!id}
            onChangeText={(title) => set({ title })}
            placeholder={stickerOf(draft.sticker).label}
            placeholderTextColor={c.faint}
            style={{ flex: 1, fontFamily: FONTS.serif, fontSize: 24, color: c.text, paddingVertical: 6 }}
          />
        </View>

        {!readOnly ? (
          <View style={styles.stickers}>
            {STICKERS.map((s) => (
              <Pressable key={s.id} onPress={() => set({ sticker: s.id })} style={[styles.sticker, draft.sticker === s.id ? { backgroundColor: c.active } : null]}>
                <StickerBadge sticker={s.id} size={32} />
              </Pressable>
            ))}
          </View>
        ) : null}

        <Group>
          <Row icon="calendar" label="Day" value={longDate(draft.date)} onPress={readOnly ? undefined : () => pickDate(draft.date, (date) => set({ date }))} />
          <View style={styles.row}>
            <Icon name="clock" size={18} color={c.muted} />
            <Text style={{ color: c.text, fontSize: 15.5, flex: 1 }}>All day</Text>
            <Switch
              disabled={readOnly}
              value={allDay}
              onValueChange={(v) => set(v ? { time: null, endTime: null, reminders: [0] } : { time: "09:00", reminders: [10] })}
              trackColor={{ true: c.accent, false: c.active }}
              thumbColor="#fff"
            />
          </View>
          {!allDay ? (
            <>
              <Row icon="alarm-clock" label="Starts" value={formatHm(draft.time!, settings.clock)} onPress={readOnly ? undefined : () => pickTime(draft.time, (time) => set({ time }))} />
              <Row
                icon="hourglass"
                label="Ends"
                value={draft.endTime ? formatHm(draft.endTime, settings.clock) : "Not set"}
                onPress={readOnly ? undefined : () => pickTime(draft.endTime ?? draft.time, (endTime) => set({ endTime }))}
              />
            </>
          ) : null}
        </Group>

        <Group>
          <Row
            icon="repeat"
            label="Repeats"
            value={REPEAT_OPTIONS.find((o) => o.value === draft.repeat)?.label ?? ""}
            onPress={
              readOnly
                ? undefined
                : () => setSheet({ title: "Repeats", choices: REPEAT_OPTIONS.map((o) => ({ label: o.label, checked: o.value === draft.repeat, onPress: () => set({ repeat: o.value, until: o.value === "none" ? null : draft.until }) })) })
            }
          />
          {draft.repeat !== "none" ? (
            <Row
              icon="flag"
              label="Until"
              value={draft.until ? longDate(draft.until) : "Forever"}
              onPress={readOnly ? undefined : () => pickDate(draft.until ?? draft.date, (until) => set({ until: until < draft.date ? draft.date : until }))}
            />
          ) : null}
        </Group>

        <Text style={[styles.label, { color: c.faint }]}>REMINDERS</Text>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
          {draft.reminders.map((m) => (
            <View key={m} style={[styles.chip, { backgroundColor: c.hover }]}>
              <Icon name="bell" size={14} color={c.muted} />
              <Text style={{ color: c.text, fontSize: 14 }}>{reminderLabel(m, allDay)}</Text>
              {!readOnly ? (
                <Pressable hitSlop={8} onPress={() => set({ reminders: draft.reminders.filter((x) => x !== m) })}>
                  <Icon name="x" size={14} color={c.faint} />
                </Pressable>
              ) : null}
            </View>
          ))}
          {!readOnly ? (
            <Pressable
              onPress={() =>
                setSheet({
                  title: "Remind me",
                  choices: [
                    ...options.filter((o) => !draft.reminders.includes(o.minutes)).map((o) => ({ label: o.label, icon: "bell" as const, onPress: () => set({ reminders: [...draft.reminders, o.minutes].sort((a, b) => a - b) }) })),
                    { label: "Custom…", icon: "pencil" as const, onPress: () => setTimeout(() => setCustomOpen("Remind me how long before? (e.g. 45 minutes, 3 hours, 2 days)"), 50) },
                  ],
                })
              }
              style={[styles.chip, { backgroundColor: c.accentSoft }]}
            >
              <Icon name="plus" size={14} color={c.accent} />
              <Text style={{ color: c.accent, fontSize: 14 }}>Add reminder</Text>
            </Pressable>
          ) : null}
          {!draft.reminders.length && readOnly ? <Text style={{ color: c.faint }}>No reminders</Text> : null}
        </View>

        <Group>
          <Row
            icon="sparkles"
            label="Celebrate"
            value={draft.celebrate ? `${CELEBRATIONS[draft.celebrate].name} sky` : "No"}
            onPress={
              readOnly
                ? undefined
                : () =>
                    setSheet({
                      title: "The sky on the day",
                      choices: [
                        { label: "Keep the usual sky", checked: !draft.celebrate, onPress: () => set({ celebrate: null }) },
                        ...CELEBRATION_IDS.map((cid) => ({ label: `${CELEBRATIONS[cid].name} sky`, icon: CELEBRATIONS[cid].icon, checked: draft.celebrate === cid, onPress: () => set({ celebrate: cid }) })),
                      ],
                    })
            }
          />
        </Group>

        <Text style={[styles.label, { color: c.faint }]}>NOTES</Text>
        <TextInput
          value={draft.notes}
          editable={!readOnly}
          onChangeText={(notes) => set({ notes })}
          multiline
          placeholder="Where, who, what to bring…"
          placeholderTextColor={c.faint}
          style={{ color: c.text, fontSize: 15.5, backgroundColor: c.hover, borderRadius: 14, padding: 12, minHeight: 70, textAlignVertical: "top" }}
        />

        {id && !readOnly ? (
          <Pressable
            onPress={async () => {
              await lumen.calendar.deleteEvent(id);
              router.back();
            }}
            style={[styles.button, { backgroundColor: c.hover, alignSelf: "flex-start", marginTop: 22 }]}
          >
            <Icon name="trash" size={16} color={c.danger} />
            <Text style={{ color: c.danger }}>Delete event</Text>
          </Pressable>
        ) : null}
        {readOnly ? <Text style={{ color: c.faint, marginTop: 18 }}>You can view this event, not change it.</Text> : null}
      </ScrollView>

      {!readOnly ? (
        <View style={[styles.footer, { backgroundColor: c.bg }]}>
          <Pressable onPress={() => router.back()} style={[styles.button, { backgroundColor: c.hover, flex: 1, justifyContent: "center" }]}>
            <Text style={{ color: c.text, fontWeight: "500" }}>Cancel</Text>
          </Pressable>
          <Pressable onPress={() => void save()} style={[styles.button, { backgroundColor: c.accent, flex: 2, justifyContent: "center" }]}>
            <Text style={{ color: c.accentText, fontWeight: "600" }}>{id ? "Save" : "Add to calendar"}</Text>
          </Pressable>
        </View>
      ) : null}

      <ChoiceSheet title={sheet?.title} choices={sheet?.choices ?? []} onClose={() => setSheet(undefined)} />
      <NameDialog
        title={customOpen}
        initial="30 minutes"
        onSave={(text) => {
          const m = parseOffset(text);
          if (m !== undefined) set({ reminders: [...new Set([...draft.reminders, m])].sort((a, b) => a - b) });
        }}
        onClose={() => setCustomOpen(undefined)}
      />
    </View>
  );
}

function Group({ children }: { children: ReactNode }) {
  const c = useColors();
  return <View style={{ backgroundColor: c.hover, borderRadius: 16, marginTop: 16, overflow: "hidden" }}>{children}</View>;
}

function Row({ icon, label, value, onPress }: { icon: Parameters<typeof Icon>[0]["name"]; label: string; value: string; onPress?: (() => void) | undefined }) {
  const c = useColors();
  return (
    <Pressable disabled={!onPress} onPress={onPress} android_ripple={{ color: c.active }} style={styles.row}>
      <Icon name={icon} size={18} color={c.muted} />
      <Text style={{ color: c.text, fontSize: 15.5 }}>{label}</Text>
      <Text style={{ color: onPress ? c.accent : c.muted, fontSize: 15, flex: 1, textAlign: "right" }} numberOfLines={1}>
        {value}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  stickers: { flexDirection: "row", flexWrap: "wrap", gap: 4, marginTop: 14 },
  sticker: { padding: 3, borderRadius: 20 },
  row: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 14, paddingVertical: 13 },
  label: { fontSize: 11, letterSpacing: 1.5, fontWeight: "600", marginTop: 20, marginBottom: 8, paddingHorizontal: 4 },
  chip: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12 },
  button: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 16, paddingVertical: 12, borderRadius: 14 },
  footer: { position: "absolute", left: 0, right: 0, bottom: 0, flexDirection: "row", gap: 10, padding: 14, paddingBottom: 22 },
});
