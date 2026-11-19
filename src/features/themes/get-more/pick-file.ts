import { File } from "expo-file-system";

import type { PickedFile } from "./use-get-more";

/** Opens the system file picker for a JSON file and reads it. Cancel gives null. */
export async function pickThemeFile(): Promise<PickedFile | null> {
  const picked = await File.pickFileAsync({ mimeTypes: ["application/json"] });
  if (picked.canceled) return null;
  return { name: picked.result.name, text: await picked.result.text() };
}
