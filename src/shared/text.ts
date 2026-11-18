/**
 * Our words are the same on both platforms; only capitalization follows the platform (DESIGN.md,
 * "Same features and words on both platforms"). `EXPO_OS` is fixed when the bundle is built.
 */
export const cased = (titleCase: string, sentenceCase: string) =>
  process.env.EXPO_OS === "ios" ? titleCase : sentenceCase;
