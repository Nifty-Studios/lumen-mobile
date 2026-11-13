import { useEffect, useMemo, useState, type ReactNode } from "react";
import { CELEBRATIONS, CELEBRATION_IDS } from "@lumen/shared/calendar";
import { birthdayLabel, pickBirthday } from "../components/Birthday";
import { ActivityIndicator, Pressable, ScrollView, Share, StyleSheet, Switch, Text, TextInput, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { ACCENT_PRESETS, ENV_TIMES, ENV_WEATHERS, MOODS, computeSky, isHexColor, searchPlaces, themeFor, type Mood, type Place } from "@lumen/shared/ambient";
import * as Application from "expo-application";
import type { IconName } from "@lumen/shared/icons";
import type { ImportSummary } from "@lumen/shared/client";
import { router } from "expo-router";
import { lumen } from "../db/lumen";
import { useAccount } from "../data/hooks";
import { SCENES, type SceneId } from "@lumen/shared/scenes";
import { ScenePreview } from "../ambient/SceneLayer";
import { useAmbient } from "../ambient/AmbientProvider";
import { weatherIcon } from "../ambient/weatherIcon";
import { Icon } from "../components/Icon";
import { pickZip, shareBytes } from "../lib/files";
import { FONTS, useColors } from "../theme";

export default function Settings() {
  const c = useColors();
  return (
    <ScrollView style={{ flex: 1, backgroundColor: c.bg }} contentContainerStyle={{ padding: 16, paddingBottom: 48 }} keyboardShouldPersistTaps="handled">
      <Account />
      <People />
      <AiConnection />
      <Appearance />
      <CalendarSection />
      <Environment />
      <Location />
      <Data />
      <Text style={{ color: c.faint, fontSize: 12, textAlign: "center", marginTop: 18 }}>
        Lumen {Application.nativeApplicationVersion ?? ""} · {lumen.account.current ? "Syncing" : "Notes stay on this phone"} · Icons by Lucide
      </Text>
    </ScrollView>
  );
}

function Section({ title, note, children }: { title: string; note?: string; children: ReactNode }) {
  const c = useColors();
  return (
    <View style={{ marginBottom: 26 }}>
      <Text style={{ fontFamily: FONTS.serif, fontSize: 24, color: c.text, marginBottom: 4 }}>{title}</Text>
      {note ? <Text style={{ color: c.muted, fontSize: 13.5, lineHeight: 19, marginBottom: 10 }}>{note}</Text> : null}
      {children}
    </View>
  );
}

function Label({ children }: { children: ReactNode }) {
  const c = useColors();
  return <Text style={{ color: c.text, fontSize: 15, marginTop: 14, marginBottom: 8 }}>{children}</Text>;
}

function Chips<T extends string>({ value, options, onChange }: { value: T; options: { value: T; label: string; icon?: IconName }[]; onChange: (v: T) => void }) {
  const c = useColors();
  return (
    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
      {options.map((o) => {
        const on = o.value === value;
        return (
          <Pressable
            key={o.value}
            onPress={() => onChange(o.value)}
            style={[styles.chip, { backgroundColor: on ? c.accent : c.hover }]}
          >
            {o.icon ? <Icon name={o.icon} size={15} color={on ? c.accentText : c.muted} /> : null}
            <Text style={{ color: on ? c.accentText : c.text, fontSize: 14 }}>{o.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function Account() {
  const c = useColors();
  const { user, available } = useAccount();
  const [busy, setBusy] = useState(false);
  if (!available) return null;
  if (!user)
    return (
      <Section title="Account" note="Sign in to see your notes on all your devices and share pages.">
        <Pressable onPress={() => router.push("/signin")} style={[styles.button, { backgroundColor: c.accent }]}>
          <Icon name="log-in" size={17} color={c.accentText} />
          <Text style={{ color: c.accentText, fontSize: 15, fontWeight: "600" }}>Sign in or create an account</Text>
        </Pressable>
      </Section>
    );
  return (
    <Section title="Account">
      <View style={[styles.accountCard, { backgroundColor: c.hover }]}>
        <View style={[styles.avatar, { backgroundColor: c.accentSoft }]}>
          <Text style={{ color: c.accent, fontSize: 18, fontWeight: "600" }}>{user.name[0]?.toUpperCase()}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ color: c.text, fontSize: 16 }} numberOfLines={1}>{user.name}</Text>
          <Text style={{ color: c.muted, fontSize: 13.5 }} numberOfLines={1}>{user.email}</Text>
        </View>
      </View>
      <Pressable
        disabled={busy}
        onPress={async () => {
          setBusy(true);
          await lumen.signOut();
          setBusy(false);
        }}
        style={[styles.button, { backgroundColor: c.hover, marginTop: 12 }]}
      >
        <Icon name="log-out" size={17} color={c.text} />
        <Text style={{ color: c.text, fontSize: 15 }}>Sign out</Text>
      </Pressable>
      <Text style={{ color: c.muted, fontSize: 13, lineHeight: 18, marginTop: 8 }}>
        Your notes stay on this phone. They just stop syncing.
      </Text>
    </Section>
  );
}

/** Friends and the dictionary each get their own screen. */
function People() {
  const c = useColors();
  const { user } = useAccount();
  const [words, setWords] = useState(lumen.dictionary.words().length);
  useEffect(() => lumen.dictionary.onChange((w) => setWords(w.length)), []);
  const link = (icon: IconName, label: string, note: string, onPress: () => void) => (
    <Pressable onPress={onPress} android_ripple={{ color: c.hover }} style={[styles.card, { backgroundColor: c.hover, marginBottom: 10 }]}>
      <View style={[styles.tile, { backgroundColor: c.accentSoft }]}>
        <Icon name={icon} size={20} color={c.accent} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ color: c.text, fontSize: 15 }}>{label}</Text>
        <Text style={{ color: c.muted, fontSize: 12.5 }}>{note}</Text>
      </View>
      <Icon name="chevron-right" size={18} color={c.faint} />
    </Pressable>
  );
  return (
    <View style={{ marginBottom: 26 }}>
      {user ? link("users", "Friends", "Share with them in one tap", () => router.push("/friends")) : null}
      {link("spell-check", "Dictionary", words ? `${words} word${words === 1 ? "" : "s"} the spellchecker accepts` : "Words the spellchecker accepts", () => router.push("/dictionary"))}
    </View>
  );
}

function AiConnection() {
  const c = useColors();
  const { user } = useAccount();
  const [links, setLinks] = useState<{ id: string; created_at: number }[]>();
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (user) lumen.account.aiLinks().then(setLinks, () => setLinks([]));
  }, [user]);
  if (!user) return null;
  const create = async () => {
    setBusy(true);
    try {
      const url = await lumen.account.createAiLink();
      setLinks(await lumen.account.aiLinks());
      await Share.share({ message: url, title: "Lumen AI connection" });
    } catch {}
    setBusy(false);
  };
  return (
    <Section
      title="AI connection"
      note="A private link that lets Claude read and edit your notes. In Claude, open Settings → Connectors → Add custom connector and paste it."
    >
      <Pressable disabled={busy} onPress={create} style={[styles.button, { backgroundColor: c.accent }]}>
        {busy ? <ActivityIndicator color={c.accentText} /> : <Icon name="link" size={17} color={c.accentText} />}
        <Text style={{ color: c.accentText, fontSize: 15, fontWeight: "600" }}>Create a link and copy it</Text>
      </Pressable>
      {links?.map((l) => (
        <View key={l.id} style={[styles.row, { gap: 10 }]}>
          <Icon name="link" size={16} color={c.muted} />
          <Text style={{ flex: 1, color: c.text }}>Link from {new Date(l.created_at).toLocaleDateString()}</Text>
          <Pressable
            onPress={async () => {
              await lumen.account.revokeAiLink(l.id);
              setLinks(await lumen.account.aiLinks());
            }}
          >
            <Text style={{ color: c.danger }}>Revoke</Text>
          </Pressable>
        </View>
      ))}
    </Section>
  );
}

function CalendarSection() {
  const c = useColors();
  const { settings, update, preview } = useAmbient();
  const [birthday, setBirthday] = useState(lumen.profile.birthday);
  useEffect(() => lumen.profile.onChange(() => setBirthday(lumen.profile.birthday())), []);
  const toggle = (label: string, note: string, value: boolean, onChange: (v: boolean) => void) => (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 12, marginTop: 14 }}>
      <View style={{ flex: 1 }}>
        <Text style={{ color: c.text, fontSize: 15 }}>{label}</Text>
        <Text style={{ color: c.muted, fontSize: 13, lineHeight: 18 }}>{note}</Text>
      </View>
      <Switch value={value} onValueChange={onChange} trackColor={{ true: c.accent, false: c.active }} thumbColor="#fff" />
    </View>
  );
  return (
    <Section title="Calendar" note="Your events, the holidays and your birthday, with reminders in the notification bar.">
      <Label>Your birthday</Label>
      <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
        <Pressable
          onPress={async () => {
            const b = await pickBirthday(birthday, birthday ? birthday.length === 10 : true);
            if (b) await lumen.profile.setBirthday(b).catch(() => {});
          }}
          style={[styles.chip, { backgroundColor: c.hover }]}
        >
          <Icon name="cake" size={15} color={c.muted} />
          <Text style={{ color: c.text, fontSize: 14 }}>{birthday ? birthdayLabel(birthday) : "Add your birthday"}</Text>
        </Pressable>
        {birthday ? (
          <Pressable onPress={() => void lumen.profile.setBirthday(null)} style={[styles.chip, { backgroundColor: c.hover }]}>
            <Text style={{ color: c.muted, fontSize: 14 }}>Remove</Text>
          </Pressable>
        ) : null}
      </View>
      {toggle("Reminders", "Notifications for your events, even with Lumen closed.", settings.reminders, (reminders) => void update({ reminders }))}
      {toggle("Holidays", "New Year, Valentine's Day, Easter, Halloween and Christmas.", settings.holidays, (holidays) => void update({ holidays }))}
      {toggle("Good morning notes", "A notification on the morning of a holiday or your birthday.", settings.holidayAlerts, (holidayAlerts) => void update({ holidayAlerts }))}
      {toggle("Celebrations in the sky", "Fireworks, hearts, snow and lights, confetti on special days.", settings.celebrations, (celebrations) => void update({ celebrations }))}
      <Label>Preview a celebration</Label>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
        {CELEBRATION_IDS.map((id) => (
          <Pressable
            key={id}
            onPress={() => {
              preview(id);
              router.dismissTo("/");
            }}
            style={[styles.chip, { backgroundColor: c.hover }]}
          >
            <Icon name={CELEBRATIONS[id].icon} size={15} color={c.muted} />
            <Text style={{ color: c.text, fontSize: 14 }}>{CELEBRATIONS[id].name}</Text>
          </Pressable>
        ))}
      </View>
    </Section>
  );
}

function Appearance() {
  const c = useColors();
  const { settings, update } = useAmbient();
  return (
    <Section title="Appearance" note="Lumen shifts with the time of day.">
      <ThemePicker />
      <AccentPicker />
      <Label>Light or dark</Label>
      <Chips
        value={settings.theme}
        onChange={(theme) => update({ theme })}
        options={[
          { value: "system", label: "System", icon: "smartphone" },
          { value: "light", label: "Light", icon: "sun" },
          { value: "dark", label: "Dark", icon: "moon" },
        ]}
      />
      <View style={styles.toggleRow}>
        <View style={{ flex: 1 }}>
          <Text style={{ color: c.text, fontSize: 15 }}>See the sky while writing</Text>
          <Text style={{ color: c.muted, fontSize: 13, lineHeight: 18, marginTop: 2 }}>Show the sky behind your pages.</Text>
        </View>
        <Switch value={settings.skyBehindPage} onValueChange={(skyBehindPage) => update({ skyBehindPage })} trackColor={{ true: c.accent, false: c.active }} thumbColor="#fff" />
      </View>
      <View style={styles.toggleRow}>
        <View style={{ flex: 1 }}>
          <Text style={{ color: c.text, fontSize: 15 }}>Spellcheck</Text>
          <Text style={{ color: c.muted, fontSize: 13, lineHeight: 18, marginTop: 2 }}>Underline misspelled words. Tap one for corrections.</Text>
        </View>
        <Switch value={settings.spellcheck} onValueChange={(spellcheck) => update({ spellcheck })} trackColor={{ true: c.accent, false: c.active }} thumbColor="#fff" />
      </View>
      {settings.spellcheck ? (
        <>
          <Label>Spelling</Label>
          <Chips
            value={settings.spelling}
            onChange={(spelling) => update({ spelling })}
            options={[
              { value: "auto", label: "Auto" },
              { value: "en-GB", label: "British" },
              { value: "en-US", label: "American" },
            ]}
          />
        </>
      ) : null}
      <Label>Motion</Label>
      <Chips value={settings.motion} onChange={(motion) => update({ motion })} options={[{ value: "full", label: "Alive" }, { value: "calm", label: "Calm" }, { value: "still", label: "Still" }]} />
      <Label>Clock</Label>
      <Chips value={settings.clock} onChange={(clock) => update({ clock })} options={[{ value: "auto", label: "Auto" }, { value: "12h", label: "12-hour" }, { value: "24h", label: "24-hour" }]} />
      <Label>Temperature</Label>
      <Chips value={settings.temperatureUnit} onChange={(temperatureUnit) => update({ temperatureUnit })} options={[{ value: "c", label: "°C" }, { value: "f", label: "°F" }]} />
    </Section>
  );
}

/** The theme: drawn decor that lives with the sky, or just the sky. */
function ThemePicker() {
  const c = useColors();
  const { settings, update, theme } = useAmbient();
  const card = (id: SceneId | null, name: string, icon: IconName) => {
    const active = settings.scene === id;
    return (
      <Pressable key={id ?? "none"} onPress={() => update({ scene: id })} style={[styles.mood, { width: 150, backgroundColor: active ? c.accentSoft : c.hover }]}>
        <LinearGradient colors={[theme.skyTop, theme.skyMid, theme.skyBottom]} style={{ height: 84, justifyContent: "flex-end", alignItems: "center" }}>
          {id ? <ScenePreview scene={id} width={150} /> : <View style={[styles.moodSun, { backgroundColor: "#fff4d6", top: 14, opacity: 0.9 }]} />}
          {active ? (
            <View style={[styles.moodCheck, { backgroundColor: c.accent }]}>
              <Icon name="check" size={12} strokeWidth={2.6} color={c.accentText} />
            </View>
          ) : null}
        </LinearGradient>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 7, padding: 9 }}>
          <Icon name={icon} size={15} color={active ? c.accent : c.muted} />
          <Text numberOfLines={1} style={{ color: c.text, fontSize: 13.5, fontWeight: "600", flex: 1 }}>
            {name}
          </Text>
        </View>
      </Pressable>
    );
  };
  return (
    <>
      <Label>Theme</Label>
      <Text style={{ color: c.muted, fontSize: 13, marginBottom: 10 }}>A little world around your sky. Lamps come on at night, snow settles, and the umbrella comes out when it rains.</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10 }} style={{ marginBottom: 6 }}>
        {card(null, "Just the sky", "cloud-sun")}
        {SCENES.map((s) => card(s.id, s.name, s.icon))}
      </ScrollView>
    </>
  );
}

/** Sky (the accent follows the time of day), a preset, or any hex color. */
function AccentPicker() {
  const c = useColors();
  const { settings, update } = useAmbient();
  const custom = settings.accent && !ACCENT_PRESETS.some((p) => p.color === settings.accent) ? settings.accent : null;
  const [hex, setHex] = useState(custom ?? "");
  const [editing, setEditing] = useState(!!custom);
  const dot = (key: string, active: boolean, color: string | null, onPress: () => void) => (
    <Pressable key={key} onPress={onPress} accessibilityLabel={key} style={[styles.swatch, { transform: [{ scale: active ? 1.12 : 1 }] }]}>
      {color ? (
        <View style={[StyleSheet.absoluteFill, { backgroundColor: color, borderRadius: 19 }]} />
      ) : (
        <LinearGradient colors={["#f08fb0", "#6cb2ff", "#f2aa5c", "#a99cff"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[StyleSheet.absoluteFill, { borderRadius: 19 }]} />
      )}
      {active ? <Icon name="check" size={16} strokeWidth={2.6} color="#fff" /> : null}
    </Pressable>
  );
  return (
    <View>
      <Label>Accent color</Label>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
        {dot("Sky", !settings.accent, null, () => {
          setEditing(false);
          void update({ accent: null });
        })}
        {ACCENT_PRESETS.map((p) =>
          dot(p.name, settings.accent === p.color, p.color, () => {
            setEditing(false);
            void update({ accent: p.color });
          }),
        )}
        <Pressable onPress={() => setEditing(true)} accessibilityLabel="Custom color" style={[styles.swatch, { backgroundColor: custom ?? c.hover, transform: [{ scale: custom ? 1.12 : 1 }] }]}>
          <Icon name={custom ? "check" : "pipette"} size={16} strokeWidth={custom ? 2.6 : 2} color={custom ? "#fff" : c.muted} />
        </Pressable>
      </View>
      <Text style={{ color: c.muted, fontSize: 12.5, marginTop: 8 }}>“Sky” changes with the time of day.</Text>
      {editing ? (
        <View style={[styles.search, { backgroundColor: c.hover }]}>
          <View style={{ width: 18, height: 18, borderRadius: 9, backgroundColor: isHexColor(hex) ? hex : c.active }} />
          <TextInput
            value={hex}
            onChangeText={(t) => {
              const v = t.startsWith("#") ? t : `#${t}`;
              setHex(v);
              if (isHexColor(v)) void update({ accent: v.toLowerCase() });
            }}
            placeholder="#2f7bd6"
            placeholderTextColor={c.faint}
            autoCapitalize="none"
            autoCorrect={false}
            maxLength={7}
            style={{ flex: 1, color: c.text, fontSize: 15, paddingVertical: 11 }}
          />
        </View>
      ) : null}
    </View>
  );
}

function MoodCard({ mood, active, onPress }: { mood: Mood; active: boolean; onPress: () => void }) {
  const c = useColors();
  const { settings } = useAmbient();
  const { sky, t } = useMemo(() => {
    const s = computeSky({ location: settings.location, envTime: mood.time, envWeather: mood.weather });
    return { sky: s, t: themeFor(s, c.dark) };
  }, [mood, settings.location, c.dark]);
  const icon = mood.id === "live" ? weatherIcon(sky.precip, sky.storm, sky.fog, sky.clouds, sky.daylight > 0.4) : mood.icon;
  return (
    <Pressable onPress={onPress} style={[styles.mood, { backgroundColor: active ? c.accentSoft : c.hover }]}>
      <LinearGradient colors={[t.skyTop, t.skyMid, t.skyBottom]} style={styles.moodSky}>
        {sky.sun.visible > 0.1 ? (
          <View style={[styles.moodSun, { backgroundColor: sky.sun.color, opacity: sky.sun.visible * (1 - sky.sun.dim * 0.6), top: 10 + (1 - Math.min(1, sky.altitude / 50)) * 16 }]} />
        ) : null}
        {sky.moon.visible > 0.3 ? <View style={[styles.moodSun, { backgroundColor: "#f2efe4", width: 16, height: 16, top: 10 }]} /> : null}
        <View style={styles.moodIcon}>
          <Icon name={icon} size={15} color="#fff" />
        </View>
        {active ? (
          <View style={[styles.moodCheck, { backgroundColor: c.accent }]}>
            <Icon name="check" size={12} strokeWidth={2.6} color={c.accentText} />
          </View>
        ) : null}
      </LinearGradient>
      <View style={{ padding: 9 }}>
        <Text numberOfLines={1} style={{ color: c.text, fontSize: 13.5, fontWeight: "600" }}>
          {mood.name}
        </Text>
        <Text numberOfLines={1} style={{ color: c.muted, fontSize: 12 }}>
          {mood.id === "live" ? sky.label : mood.description}
        </Text>
      </View>
    </Pressable>
  );
}

function Environment() {
  const { settings, update } = useAmbient();
  return (
    <Section title="Sky & mood" note="Show your real sky, or pick a mood.">
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10, paddingVertical: 4 }} style={{ marginHorizontal: -16 }}>
        <View style={{ width: 6 }} />
        {MOODS.map((m) => (
          <MoodCard key={m.id} mood={m} active={settings.envTime === m.time && settings.envWeather === m.weather} onPress={() => update({ envTime: m.time, envWeather: m.weather })} />
        ))}
        <View style={{ width: 6 }} />
      </ScrollView>
      <Label>Time of day</Label>
      <Chips value={settings.envTime} onChange={(envTime) => update({ envTime })} options={ENV_TIMES} />
      <Label>Weather</Label>
      <Chips value={settings.envWeather} onChange={(envWeather) => update({ envWeather })} options={ENV_WEATHERS} />
    </Section>
  );
}

function Location() {
  const c = useColors();
  const { settings, update, locateDevice, setLocation } = useAmbient();
  const [query, setQuery] = useState("");
  const [places, setPlaces] = useState<Place[]>([]);
  const [status, setStatus] = useState<string>();

  useEffect(() => {
    if (query.trim().length < 2) return setPlaces([]);
    const t = setTimeout(() => searchPlaces(query).then(setPlaces, () => setPlaces([])), 250);
    return () => clearTimeout(t);
  }, [query]);

  const loc = settings.location;
  return (
    <Section title="Location & weather" note="Used for sunrise, sunset and the weather.">
      <View style={[styles.card, { backgroundColor: c.hover }]}>
        <View style={[styles.tile, { backgroundColor: c.accentSoft }]}>
          <Icon name="map-pin" size={20} color={c.accent} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ color: c.text, fontSize: 15 }}>{loc?.label ?? "Not set yet"}</Text>
          <Text style={{ color: c.muted, fontSize: 12.5 }}>{status ?? (loc ? (loc.source === "device" ? "From this phone" : loc.source === "city" ? "Chosen city" : "From your timezone") : "Using your timezone")}</Text>
        </View>
      </View>
      <Pressable
        style={[styles.button, { backgroundColor: c.accent, marginTop: 10 }]}
        onPress={async () => {
          setStatus("Finding you…");
          try {
            const l = await locateDevice();
            setStatus(`Set to ${l.label}`);
          } catch (e) {
            setStatus(String(e).replace(/^Error: /, ""));
          }
        }}
      >
        <Icon name="locate-fixed" size={17} color={c.accentText} />
        <Text style={{ color: c.accentText, fontWeight: "600" }}>Use this phone's location</Text>
      </Pressable>
      <View style={[styles.search, { backgroundColor: c.hover }]}>
        <Icon name="search" size={16} color={c.faint} />
        <TextInput value={query} onChangeText={setQuery} placeholder="Or search for a city" placeholderTextColor={c.faint} style={{ flex: 1, color: c.text, fontSize: 15, paddingVertical: 11 }} />
      </View>
      {places.map((p, i) => (
        <Pressable
          key={i}
          style={styles.place}
          onPress={async () => {
            setQuery("");
            setPlaces([]);
            await setLocation({ lat: p.lat, lon: p.lon, label: p.name, source: "city" });
            setStatus(`Set to ${p.name}`);
          }}
        >
          <Icon name="map-pin" size={15} color={c.faint} />
          <Text style={{ color: c.text }}>{p.name}</Text>
          <Text numberOfLines={1} style={{ color: c.muted, flex: 1 }}>
            {p.detail}
          </Text>
        </Pressable>
      ))}
      <View style={styles.row}>
        <Text style={{ color: c.text, fontSize: 15, flex: 1 }}>Live weather</Text>
        <Switch value={settings.liveWeather} onValueChange={(liveWeather) => update({ liveWeather })} trackColor={{ true: c.accent, false: c.active }} thumbColor="#fff" />
      </View>
    </Section>
  );
}

function Data() {
  const c = useColors();
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<string>();
  const [summary, setSummary] = useState<ImportSummary | null>(null);

  const run = async (label: string, task: () => Promise<void>) => {
    setBusy(label);
    setMessage(undefined);
    try {
      await task();
    } catch (e) {
      setMessage(String(e).replace(/^Error: /, ""));
    } finally {
      setBusy(null);
    }
  };

  const button = (icon: IconName, label: string, onPress: () => void, primary = false) => (
    <Pressable disabled={!!busy} onPress={onPress} style={[styles.button, { backgroundColor: primary ? c.accent : c.active, opacity: busy ? 0.6 : 1 }]}>
      <Icon name={icon} size={17} color={primary ? c.accentText : c.text} />
      <Text style={{ color: primary ? c.accentText : c.text, fontWeight: "600" }}>{label}</Text>
    </Pressable>
  );

  return (
    <Section title="Backup & import" note="All your notes in one file. Restore it on any device.">
      <View style={{ gap: 10 }}>
        {button("download", "Export backup", () =>
          run("Packing your notes…", async () => {
            const backup = await lumen.exportBackup();
            await shareBytes(backup.fileName, backup.bytes);
            setMessage(`Backup ready: ${backup.manifest.pages} pages`);
          }), true)}
        {button("upload", "Restore from a backup", () =>
          run("Restoring…", async () => {
            const file = await pickZip();
            if (!file) return;
            const r = await lumen.restoreBackup(file.bytes, (d, t) => setBusy(`Restoring… ${Math.round((d / t) * 100)}%`));
            setMessage(`Restored ${r.pages} pages from ${new Date(r.createdAt).toLocaleDateString()}`);
          }))}
        {button("file-up", "Import from Notion", () =>
          run("Importing…", async () => {
            setSummary(null);
            const file = await pickZip();
            if (!file) return;
            const r = await lumen.importNotion(file.bytes, { onProgress: (d, t) => setBusy(`Importing… ${d} of ${t} pages`) });
            setSummary(r);
            setMessage(r.pages ? `Imported ${r.pages} pages from Notion` : (r.warnings[0] ?? "Nothing new to import"));
          }))}
      </View>
      <Text style={{ color: c.muted, fontSize: 12.5, lineHeight: 18, marginTop: 10 }}>
        From Notion: Settings → Export all workspace content → Markdown & CSV.
      </Text>
      {busy ? (
        <View style={[styles.row, { gap: 10 }]}>
          <ActivityIndicator color={c.accent} />
          <Text style={{ color: c.muted }}>{busy}</Text>
        </View>
      ) : null}
      {message ? <Text style={{ color: c.text, marginTop: 12 }}>{message}</Text> : null}
      {summary ? (
        <Text style={{ color: c.muted, fontSize: 12.5, marginTop: 4 }}>
          {summary.pages} pages · {summary.blocks} blocks · {summary.images} images
          {summary.skipped ? ` · ${summary.skipped} already here` : ""}
        </Text>
      ) : null}
    </Section>
  );
}

const styles = StyleSheet.create({
  toggleRow: { flexDirection: "row", alignItems: "center", gap: 12, marginTop: 16 },
  swatch: { width: 38, height: 38, borderRadius: 19, alignItems: "center", justifyContent: "center" },
  accountCard: { flexDirection: "row", alignItems: "center", gap: 12, borderRadius: 18, padding: 14 },
  avatar: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center" },
  chip: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 14, paddingVertical: 9, borderRadius: 14 },
  mood: { width: 142, borderRadius: 18, overflow: "hidden" },
  moodSky: { height: 78 },
  moodSun: { position: "absolute", right: 14, width: 20, height: 20, borderRadius: 10 },
  moodIcon: { position: "absolute", left: 8, bottom: 8, width: 28, height: 28, borderRadius: 9, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(0,0,0,0.22)" },
  moodCheck: { position: "absolute", left: 8, top: 8, width: 20, height: 20, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  card: { flexDirection: "row", alignItems: "center", gap: 12, padding: 14, borderRadius: 18 },
  tile: { width: 42, height: 42, borderRadius: 13, alignItems: "center", justifyContent: "center" },
  button: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 13, borderRadius: 16 },
  search: { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 14, borderRadius: 16, marginTop: 10 },
  place: { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 10, paddingVertical: 11 },
  row: { flexDirection: "row", alignItems: "center", marginTop: 14 },
});
