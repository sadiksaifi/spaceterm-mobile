import type { ConfigContext, ExpoConfig } from "expo/config";

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: "SpaceTerm",
  slug: "SpaceTerm",
  version: "0.0.0",
  platforms: ["ios", "android"],
  orientation: "portrait",
  icon: "./assets/brand/ios/appearances/Default.png",
  scheme: "spacetermmobile",
  userInterfaceStyle: "automatic",
  ios: {
    bundleIdentifier: "com.peblon.spaceterm.mobile",
    icon: "./assets/brand/apple/SpaceTerm.icon",
  },
  android: {
    package: "com.peblon.spaceterm.mobile",
    adaptiveIcon: {
      foregroundImage: "./assets/brand/android/adaptive/foreground.png",
      backgroundImage: "./assets/brand/android/adaptive/background.png",
      monochromeImage: "./assets/brand/android/adaptive/monochrome.png",
    },
    predictiveBackGestureEnabled: false,
  },
  plugins: [
    "expo-router",
    [
      "expo-splash-screen",
      {
        image: "./assets/brand/splash/light.png",
        imageWidth: 200,
        backgroundColor: "#FBFCFF",
        dark: {
          image: "./assets/brand/splash/dark.png",
          backgroundColor: "#06070F",
        },
      },
    ],
  ],
  experiments: {
    typedRoutes: true,
    reactCompiler: true,
  },
});
