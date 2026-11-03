// Asking for (and changing) the birthday the calendar celebrates.

import { useState } from "react";
import { Modal, Pressable, StyleSheet, Switch, Text, View } from "react-native";
import { DateTimePickerAndroid } from "@react-native-community/datetimepicker";
import { parseYmd, ymd } from "@lumen/shared/calendar";
import { lumen } from "../db/lumen";
import { Icon } from "./Icon";
import { FONTS, useColors } from "../theme";

export const birthdayLabel = (b: string) =>
  b.length === 10
    ? parseYmd(b).toLocaleDateString(undefined, { day: "numeric", month: "long", year: "numeric" })
    : parseYmd(`2000-${b}`).toLocaleDateString(undefined, { day: "numeric", month: "long" });

/** Opens Android's date picker; resolves to "YYYY-MM-DD" or "MM-DD" (keepYear false), or undefined. */
export function pickBirthday(current: string | null, keepYear: boolean): Promise<string | undefined> {
  const start = current ? (current.length === 10 ? parseYmd(current) : parseYmd(`2000-${current}`)) : new Date(2000, 0, 1);
  return new Promise((resolve) =>
    DateTimePickerAndroid.open({
      value: start,
      mode: "date",
      maximumDate: new Date(),
      onChange: (e, d) => resolve(e.type === "set" && d ? (keepYear ? ymd(d) : ymd(d).slice(5)) : undefined),
    }),
  );
}

export function BirthdayPrompt({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const c = useColors();
  const [value, setValue] = useState<string | null>(null);
  const [keepYear, setKeepYear] = useState(true);
  const finish = async (action: "save" | "later" | "never") => {
    if (action === "save" && value) await lumen.profile.setBirthday(keepYear || value.length === 5 ? value : value.slice(5)).catch(() => {});
    else await lumen.profile.skipAsking(action === "never");
    onClose();
  };
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={() => void finish("later")}>
      <View style={[styles.backdrop, { backgroundColor: c.scrim }]}>
        <View style={[styles.card, { backgroundColor: c.surface }]}>
          <View style={[styles.icon, { backgroundColor: c.accentSoft }]}>
            <Icon name="cake" size={24} color={c.accent} />
          </View>
          <Text style={{ fontFamily: FONTS.serif, fontSize: 24, color: c.text }}>When's your birthday?</Text>
          <Text style={{ color: c.muted, fontSize: 14, lineHeight: 20, marginTop: 6 }}>Lumen puts it on your calendar and celebrates with you on the day.</Text>
          <Pressable onPress={async () => setValue((await pickBirthday(value, true)) ?? value)} style={[styles.pick, { backgroundColor: c.hover }]}>
            <Icon name="calendar" size={18} color={c.muted} />
            <Text style={{ color: value ? c.text : c.faint, fontSize: 16 }}>{value ? birthdayLabel(value) : "Pick the day"}</Text>
          </Pressable>
          {value ? (
            <View style={{ flexDirection: "row", alignItems: "center", marginTop: 10 }}>
              <Text style={{ color: c.muted, fontSize: 14, flex: 1 }}>Remember the year (to say how old you're turning)</Text>
              <Switch value={keepYear} onValueChange={setKeepYear} trackColor={{ true: c.accent, false: c.active }} thumbColor="#fff" />
            </View>
          ) : null}
          <View style={{ flexDirection: "row", gap: 8, marginTop: 20, alignItems: "center" }}>
            <Pressable onPress={() => void finish("never")} hitSlop={6}>
              <Text style={{ color: c.faint, fontSize: 13 }}>Don't ask again</Text>
            </Pressable>
            <View style={{ flex: 1 }} />
            <Pressable onPress={() => void finish("later")} style={[styles.button, { backgroundColor: c.hover }]}>
              <Text style={{ color: c.text }}>Not now</Text>
            </Pressable>
            <Pressable disabled={!value} onPress={() => void finish("save")} style={[styles.button, { backgroundColor: c.accent, opacity: value ? 1 : 0.5 }]}>
              <Text style={{ color: c.accentText, fontWeight: "600" }}>Save</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: "center", padding: 22 },
  card: { borderRadius: 26, padding: 22, elevation: 12 },
  icon: { width: 48, height: 48, borderRadius: 16, alignItems: "center", justifyContent: "center", marginBottom: 12 },
  pick: { flexDirection: "row", alignItems: "center", gap: 10, padding: 14, borderRadius: 14, marginTop: 16 },
  button: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 12 },
});
