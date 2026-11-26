import type { ConfigContext, ExpoConfig } from "expo/config";

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: "SpaceTerm",
  slug: "SpaceTerm",
  version: "0.0.0",
  platforms: ["ios", "android"],
  orientation: "portrait",
  icon: "./assets/brand/ios/appearances/Default.png",
  // `spaceterm` opens the Invitation Links that Invite Device and `spaceterm pair` make.
  scheme: ["spacetermmobile", "spaceterm"],
  userInterfaceStyle: "automatic",
  ios: {
    bundleIdentifier: "com.peblon.spaceterm.mobile",
    icon: "./assets/brand/apple/SpaceTerm.icon",
    infoPlist: {
      NSLocalNetworkUsageDescription: "SpaceTerm connects to your Machines on the local network.",
    },
  },
  android: {
    package: "com.peblon.spaceterm.mobile",
    adaptiveIcon: {
      foregroundImage: "./assets/brand/android/adaptive/foreground.png",
      backgroundImage: "./assets/brand/android/adaptive/background.png",
      monochromeImage: "./assets/brand/android/adaptive/monochrome.png",
    },
    predictiveBackGestureEnabled: false,
    // Android 17 lets an app reach a Machine on the local network only with this permission.
    permissions: ["android.permission.ACCESS_LOCAL_NETWORK"],
  },
  plugins: [
    "expo-router",
    [
      "expo-camera",
      {
        cameraPermission: "SpaceTerm uses the camera to scan the pairing QR code.",
        microphonePermission: false,
        recordAudioAndroid: false,
      },
    ],
    [
      "expo-build-properties",
      {
        ios: { deploymentTarget: "26.0" },
        // libspaceterm ships for arm64 only, the ABI of current phones and Apple silicon emulators.
        android: { buildArchs: ["arm64-v8a"] },
      },
    ],
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
