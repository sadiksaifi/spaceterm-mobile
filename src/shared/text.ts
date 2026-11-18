/**
 * Our words are the same on both platforms; only capitalization follows the platform (DESIGN.md,
 * "Same features and words on both platforms"). Reads `EXPO_OS` once, when the module loads.
 */
export const cased = (titleCase: string, sentenceCase: string) =>
  process.env.EXPO_OS === "ios" ? titleCase : sentenceCase;
