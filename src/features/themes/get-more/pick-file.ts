import { getDocumentAsync } from "expo-document-picker";
import { File } from "expo-file-system";

import type { PickedFile } from "./use-get-more";

/**
 * A downloaded theme file often carries a plain text or generic type, not JSON's, so the picker
 * offers those too. A file that is not a theme is reported after it is read.
 */
const THEME_FILE_TYPES = ["application/json", "text/plain", "application/octet-stream"];

/**
 * Opens the system file picker for a theme file and reads it. Cancel gives null. The document
 * picker gives the name the person saw; on Android a picked file's path holds only an id.
 */
export async function pickThemeFile(): Promise<PickedFile | null> {
  const picked = await getDocumentAsync({ type: THEME_FILE_TYPES, copyToCacheDirectory: true });
  const asset = picked.canceled ? undefined : picked.assets[0];
  if (asset === undefined) return null;
  const copy = new File(asset.uri);
  try {
    return { name: asset.name, text: await copy.text() };
  } finally {
    // The copy is only for reading; the themes keep what they need.
    if (copy.exists) copy.delete();
  }
}
