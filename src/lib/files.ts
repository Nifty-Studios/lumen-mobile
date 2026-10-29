// Backups leave the phone through the share sheet (Drive, Files, a chat...); imports come in
// through the document picker.

import { File, Paths } from "expo-file-system";
import * as DocumentPicker from "expo-document-picker";
import * as Sharing from "expo-sharing";

export async function shareBytes(name: string, bytes: Uint8Array) {
  const file = new File(Paths.cache, name);
  if (file.exists) file.delete();
  await file.write(bytes);
  await Sharing.shareAsync(file.uri, { mimeType: "application/zip", dialogTitle: "Save your Lumen backup" });
}

export async function pickZip(): Promise<{ name: string; bytes: Uint8Array } | null> {
  const result = await DocumentPicker.getDocumentAsync({ type: ["application/zip", "application/x-zip-compressed", "application/octet-stream"], copyToCacheDirectory: true });
  const asset = result.canceled ? undefined : result.assets[0];
  if (!asset) return null;
  return { name: asset.name, bytes: await new File(asset.uri).bytes() };
}
