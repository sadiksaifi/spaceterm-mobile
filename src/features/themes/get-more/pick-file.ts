import { getDocumentAsync } from "expo-document-picker";
import { File, FileMode } from "expo-file-system";

import type { PickedFile } from "./use-get-more";

/**
 * A downloaded theme file often carries a plain text or generic type, not JSON's, so the picker
 * offers those too. A file that is not a theme is reported after it is read.
 */
const THEME_FILE_TYPES = ["application/json", "text/plain", "application/octet-stream"];
/** The largest file read as a theme; a Zed theme file is far smaller. */
const MAX_THEME_FILE = 8 * 1024 * 1024;

/**
 * Opens the system file picker for a theme file and reads it. Cancel gives null. The document
 * picker gives the name the person saw; on Android a picked file's path holds only an id.
 */
export async function pickThemeFile(): Promise<PickedFile | null> {
  // No copy of its own: the file is read once, and no further than the limit.
  const picked = await getDocumentAsync({ type: THEME_FILE_TYPES, copyToCacheDirectory: false });
  const asset = picked.canceled ? undefined : picked.assets[0];
  if (asset === undefined) return null;
  const file = new File(asset.uri);
  // iOS hands over the system's copy in the app's own folders, which is SpaceTerm's to delete.
  // Android hands over the person's document itself, which must stay.
  const ownCopy = asset.uri.startsWith("file:");
  try {
    if ((asset.size ?? 0) > MAX_THEME_FILE)
      return { kind: "failed", name: asset.name, reason: "too-large" };
    // A provider may not give the size, so the read itself stops one byte past the limit.
    const handle = file.open(FileMode.ReadOnly);
    let bytes: Uint8Array;
    try {
      bytes = await handle.readBytes(MAX_THEME_FILE + 1);
    } finally {
      handle.close();
    }
    if (bytes.length > MAX_THEME_FILE)
      return { kind: "failed", name: asset.name, reason: "too-large" };
    return { kind: "read", name: asset.name, text: new TextDecoder().decode(bytes) };
  } catch {
    return { kind: "failed", name: asset.name, reason: "unreadable" };
  } finally {
    if (ownCopy && file.exists) file.delete();
  }
}
