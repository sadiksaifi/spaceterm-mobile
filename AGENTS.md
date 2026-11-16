This is an Expo/React Native mobile application. Prioritize mobile-first patterns, performance, and cross-platform compatibility.

## Expo has changed — do not trust your training data

Expo ships breaking changes every SDK release. APIs you remember are likely renamed, moved, or removed. Before writing any code that touches an Expo, EAS, or React Native API:

1. Read the major version of the `expo` package in `package.json`.
2. Fetch the matching versioned docs: `https://docs.expo.dev/versions/v<major>.0.0/`
3. For anything else, fetch https://docs.expo.dev/llms.txt — an index of all Expo docs with corrections to common LLM misconceptions. Follow its links to the specific page you need; never answer from memory.

## Commands

Tools are pinned in `.mise.toml`. Run them through `pnpm` and the scripts in `package.json`.

- Add Expo and React Native packages with `pnpm expo install <package>`, which resolves SDK-compatible versions. Add other dev tools with `pnpm add -D <package>`.
- Name plain-logic tests `*.test.ts` (Vitest) and component tests `*.test.tsx` (Jest with `jest-expo`).
- Diagnose dependency and config issues with `pnpm dlx expo-doctor`.

Before declaring a task done, run `pnpm fmt:check`, `pnpm lint`, `pnpm typecheck`, and `pnpm test`.

## Navigation & Routing

- Use **Expo Router** for all navigation. Routes live in `src/app/` — every file there is a screen, `_layout.tsx` files define navigators. Keep non-route code (components, hooks, utils) outside `src/app/`.
- Import `Link`, `router`, and `useLocalSearchParams` from `expo-router`.
- Docs: https://docs.expo.dev/router/introduction.md

## Building with EAS

Use EAS to build, sign, and submit the app in the cloud (`eas build`, `eas submit`) and to ship over-the-air updates (`eas update`). Local development builds run through `pnpm ios` and `pnpm android`. Run EAS CLI as `eas`, pinned in `.mise.toml`.
Docs: https://docs.expo.dev/eas/index.md

## Rules

- If `ios/` and `android/` directories do not exist, they are generated (Continuous Native Generation). Never create or edit them by hand — configure native behavior in `app.config.ts` and config plugins.
- The app runs as a development build on iOS and Android only. After adding a library with native code, rebuild with `pnpm ios` or `pnpm android`.
- Prefer recommended Expo modules over third-party libraries, and check your available skills before adding dependencies. Docs: https://docs.expo.dev/versions/latest/index.md
