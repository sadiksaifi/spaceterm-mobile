import { File } from "expo-file-system";

import type { PickedFile } from "./use-get-more";

/**
 * A downloaded theme file often carries a plain text or generic type, not JSON's, so the picker
 * offers those too. A file that is not a theme is reported after it is read.
 */
const THEME_FILE_TYPES = ["application/json", "text/plain", "application/octet-stream"];

/** Opens the system file picker for a theme file and reads it. Cancel gives null. */
export async function pickThemeFile(): Promise<PickedFile | null> {
  const picked = await File.pickFileAsync({ mimeTypes: THEME_FILE_TYPES });
  if (picked.canceled) return null;
  return { name: picked.result.name, text: await picked.result.text() };
}
