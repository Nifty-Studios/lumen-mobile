import { useEffect, useMemo, useState, type ReactNode } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { ENV_TIMES, ENV_WEATHERS, MOODS, computeSky, searchPlaces, themeFor, type Mood, type Place } from "@lumen/shared/ambient";
import type { IconName } from "@lumen/shared/icons";
import type { ImportSummary } from "@lumen/shared/client";
import { lumen } from "../db/lumen";
import { useAmbient } from "../ambient/AmbientProvider";
import { weatherIcon } from "../ambient/weatherIcon";
import { Icon } from "../components/Icon";
import { pickZip, shareBytes } from "../lib/files";
import { FONTS, useColors } from "../theme";

export default function Settings() {
  const c = useColors();
  return (
    <ScrollView style={{ flex: 1, backgroundColor: c.bg }} contentContainerStyle={{ padding: 16, paddingBottom: 48 }} keyboardShouldPersistTaps="handled">
      <Appearance />
      <Environment />
      <Location />
      <Data />
      <Text style={{ color: c.faint, fontSize: 12, textAlign: "center", marginTop: 18 }}>
        Lumen 0.1.0 · {lumen.sync ? "Sync on" : "Notes stay on this phone"} · Icons by Lucide
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

function Appearance() {
  const { settings, update } = useAmbient();
  return (
    <Section title="Appearance" note="Dark mode lifts a little while the sun is up and goes deep at night; light mode turns warm after dark.">
      <Label>Theme</Label>
      <Chips
        value={settings.theme}
        onChange={(theme) => update({ theme })}
        options={[
          { value: "system", label: "System", icon: "smartphone" },
          { value: "light", label: "Light", icon: "sun" },
          { value: "dark", label: "Dark", icon: "moon" },
        ]}
      />
      <Label>Motion</Label>
      <Chips value={settings.motion} onChange={(motion) => update({ motion })} options={[{ value: "full", label: "Alive" }, { value: "calm", label: "Calm" }, { value: "still", label: "Still" }]} />
      <Label>Clock</Label>
      <Chips value={settings.clock} onChange={(clock) => update({ clock })} options={[{ value: "auto", label: "Auto" }, { value: "12h", label: "12-hour" }, { value: "24h", label: "24-hour" }]} />
      <Label>Temperature</Label>
      <Chips value={settings.temperatureUnit} onChange={(temperatureUnit) => update({ temperatureUnit })} options={[{ value: "c", label: "°C" }, { value: "f", label: "°F" }]} />
    </Section>
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
    <Section title="Sky & mood" note="Live follows your real sun and weather. Or set the scene yourself.">
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
    <Section title="Location & weather" note="Sets sunrise, sunset and the weather. With live weather on, only the coordinates go to Open-Meteo, about every 15 minutes.">
      <View style={[styles.card, { backgroundColor: c.hover }]}>
        <View style={[styles.tile, { backgroundColor: c.accentSoft }]}>
          <Icon name="map-pin" size={20} color={c.accent} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ color: c.text, fontSize: 15 }}>{loc?.label ?? "Not set yet"}</Text>
          <Text style={{ color: c.muted, fontSize: 12.5 }}>{status ?? (loc ? `${loc.source === "device" ? "From this phone" : loc.source === "city" ? "Chosen city" : "From your timezone"} · ${loc.lat.toFixed(2)}, ${loc.lon.toFixed(2)}` : "Using your timezone")}</Text>
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
    <Section title="Backup & import" note="Your whole workspace and its history in one .zip, with every page as readable Markdown. Restore it on any device, even offline.">
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
        For Notion: Settings → General → Export all workspace content → Markdown & CSV, with subpages.
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
