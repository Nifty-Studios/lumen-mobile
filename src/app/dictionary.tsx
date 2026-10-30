// The personal dictionary: words the spellchecker accepts, each with an optional meaning. Tap
// an underlined word in a page to add it there; this screen lists them and edits any. It syncs
// to the account.

import { useEffect, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { lumen } from "../db/lumen";
import { Icon } from "../components/Icon";
import { useColors } from "../theme";

export default function Dictionary() {
  const c = useColors();
  const [entries, setEntries] = useState(lumen.dictionary.entries);
  const [word, setWord] = useState("");
  const [meaning, setMeaning] = useState("");
  const [filter, setFilter] = useState("");
  const [editing, setEditing] = useState<{ word: string; meaning: string }>();
  useEffect(() => lumen.dictionary.onChange(() => setEntries(lumen.dictionary.entries())), []);
  const q = filter.trim().toLowerCase();
  const shown = entries.filter((e) => !q || e.word.toLowerCase().includes(q) || e.meaning?.toLowerCase().includes(q));
  const add = () => {
    if (word.trim()) void lumen.dictionary.add(word.trim(), meaning);
    setWord("");
    setMeaning("");
  };
  const saveEdit = () => {
    if (editing) void lumen.dictionary.define(editing.word, editing.meaning);
    setEditing(undefined);
  };
  const input = [styles.input, { backgroundColor: c.hover, color: c.text }];

  return (
    <ScrollView style={{ backgroundColor: c.bg }} contentContainerStyle={styles.wrap} keyboardShouldPersistTaps="handled">
      <Text style={{ color: c.muted, fontSize: 14, lineHeight: 20, marginBottom: 14 }}>
        Words the spellchecker accepts, such as names, places and words you made up, each with a meaning if you like. Tap an underlined word in a page to add it.
      </Text>
      <TextInput style={input} placeholder="Word" placeholderTextColor={c.faint} value={word} onChangeText={setWord} autoCapitalize="none" autoCorrect={false} />
      <TextInput
        style={[input, { marginTop: 8, minHeight: 48 }]}
        placeholder="Meaning (optional)"
        placeholderTextColor={c.faint}
        value={meaning}
        onChangeText={setMeaning}
        multiline
      />
      <Pressable onPress={add} disabled={!word.trim()} style={[styles.primary, { backgroundColor: c.accent, opacity: word.trim() ? 1 : 0.6 }]}>
        <Icon name="plus" size={18} color={c.accentText} />
        <Text style={{ color: c.accentText, fontWeight: "600", fontSize: 15 }}>Add to dictionary</Text>
      </Pressable>

      {entries.length > 8 ? (
        <TextInput style={[input, { marginTop: 18 }]} placeholder={`Search ${entries.length} words`} placeholderTextColor={c.faint} value={filter} onChangeText={setFilter} autoCapitalize="none" />
      ) : null}
      {entries.length === 0 ? <Text style={{ color: c.muted, marginTop: 24 }}>No words yet.</Text> : null}
      <View style={{ marginTop: 14 }}>
        {shown.map((e) => (
          <View key={e.word} style={styles.entry}>
            <View style={{ flex: 1 }}>
              <Text style={{ color: c.text, fontSize: 16, fontWeight: "600" }}>{e.word}</Text>
              {editing?.word === e.word ? (
                <TextInput
                  autoFocus
                  style={[input, { marginTop: 6, minHeight: 44 }]}
                  value={editing.meaning}
                  onChangeText={(m) => setEditing({ word: e.word, meaning: m })}
                  onBlur={saveEdit}
                  placeholder="What it means"
                  placeholderTextColor={c.faint}
                  multiline
                />
              ) : (
                <Pressable onPress={() => setEditing({ word: e.word, meaning: e.meaning ?? "" })} hitSlop={6}>
                  <Text style={{ color: e.meaning ? c.muted : c.faint, fontSize: 14, lineHeight: 20, marginTop: 2 }}>{e.meaning ?? "Add a meaning"}</Text>
                </Pressable>
              )}
            </View>
            <Pressable hitSlop={10} onPress={() => void lumen.dictionary.remove(e.word)} accessibilityLabel={`Remove ${e.word}`} style={{ paddingTop: 3 }}>
              <Icon name="x" size={17} color={c.faint} />
            </Pressable>
          </View>
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  wrap: { padding: 18, paddingBottom: 48 },
  input: { borderRadius: 14, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15.5 },
  primary: { flexDirection: "row", gap: 8, borderRadius: 14, paddingVertical: 13, alignItems: "center", justifyContent: "center", marginTop: 10 },
  entry: { flexDirection: "row", gap: 12, paddingVertical: 12 },
});
