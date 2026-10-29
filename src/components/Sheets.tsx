// Two small modals Android needs: a list of choices (its alerts only fit three buttons) and a
// name prompt (it has no Alert.prompt).

import { useEffect, useState } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import type { IconName } from "@lumen/shared/icons";
import { Icon } from "./Icon";
import { useColors } from "../theme";

export interface Choice {
  label: string;
  icon?: IconName;
  /** Indent level, for trees. */
  depth?: number;
  danger?: boolean;
  checked?: boolean;
  onPress: () => void;
}

export function ChoiceSheet({ title, choices, onClose }: { title: string | undefined; choices: Choice[]; onClose: () => void }) {
  const c = useColors();
  return (
    <Modal visible={!!title} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={[styles.backdrop, { backgroundColor: c.scrim }]} onPress={onClose}>
        <Pressable style={[styles.sheet, { backgroundColor: c.surface }]} onPress={() => {}}>
          <Text style={[styles.title, { color: c.faint }]}>{title?.toUpperCase()}</Text>
          <ScrollView style={{ maxHeight: 420 }}>
            {choices.map((ch, i) => (
              <Pressable
                key={i}
                android_ripple={{ color: c.hover }}
                onPress={() => {
                  onClose();
                  ch.onPress();
                }}
                style={[styles.row, { paddingLeft: 16 + (ch.depth ?? 0) * 16 }]}
              >
                {ch.icon ? <Icon name={ch.icon} size={18} color={ch.danger ? c.danger : c.muted} /> : null}
                <Text style={{ flex: 1, fontSize: 15.5, color: ch.danger ? c.danger : c.text }} numberOfLines={1}>
                  {ch.label}
                </Text>
                {ch.checked ? <Icon name="check" size={17} color={c.accent} /> : null}
              </Pressable>
            ))}
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

export function NameDialog({ title, initial = "", onSave, onClose }: { title: string | undefined; initial?: string; onSave: (name: string) => void; onClose: () => void }) {
  const c = useColors();
  const [name, setName] = useState(initial);
  useEffect(() => setName(initial), [title, initial]);
  const save = () => {
    if (name.trim()) onSave(name.trim());
    onClose();
  };
  return (
    <Modal visible={!!title} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={[styles.backdrop, { backgroundColor: c.scrim, justifyContent: "center" }]} onPress={onClose}>
        <Pressable style={[styles.dialog, { backgroundColor: c.surface }]} onPress={() => {}}>
          <Text style={{ color: c.text, fontSize: 17, fontWeight: "600", marginBottom: 12 }}>{title}</Text>
          <TextInput
            autoFocus
            value={name}
            onChangeText={setName}
            onSubmitEditing={save}
            placeholder="Name"
            placeholderTextColor={c.faint}
            style={{ backgroundColor: c.hover, color: c.text, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 11, fontSize: 15.5 }}
          />
          <View style={{ flexDirection: "row", justifyContent: "flex-end", gap: 8, marginTop: 14 }}>
            <Pressable onPress={onClose} style={styles.button}>
              <Text style={{ color: c.muted }}>Cancel</Text>
            </Pressable>
            <Pressable onPress={save} style={[styles.button, { backgroundColor: c.accent }]}>
              <Text style={{ color: c.accentText, fontWeight: "600" }}>Save</Text>
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: "flex-end", padding: 12 },
  sheet: { borderRadius: 24, paddingVertical: 10 },
  title: { fontSize: 11, letterSpacing: 1.5, fontWeight: "600", paddingHorizontal: 18, paddingVertical: 8 },
  row: { flexDirection: "row", alignItems: "center", gap: 12, paddingRight: 16, paddingVertical: 13 },
  dialog: { borderRadius: 24, padding: 20, marginHorizontal: 12 },
  button: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 12 },
});
