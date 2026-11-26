import type { ConfigContext, ExpoConfig } from "expo/config";
import { withXcodeProject } from "expo/config-plugins";

export default (context: ConfigContext): ExpoConfig => withArm64Only(app(context));

const app = ({ config }: ConfigContext): ExpoConfig => ({
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
    // Android 17 grants local network access to apps that target SDK 36 and don't declare
    // ACCESS_LOCAL_NETWORK. Declaring it makes it a runtime permission the person can deny.
    // Declare it once the target SDK is 37, where Android 17 requires it.
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
        // SpaceTerm supports arm64 only, on both platforms: libspaceterm ships no other ABI.
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

/** Builds the iOS app for arm64 only. Xcode otherwise adds x86_64 to Release simulator builds. */
const withArm64Only = (config: ExpoConfig) =>
  withXcodeProject(config, (config) => {
    config.modResults.updateBuildProperty("ARCHS", "arm64");
    return config;
  });
