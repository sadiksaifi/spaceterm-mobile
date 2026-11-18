import { Linking } from "react-native";

import HomeScreen from "@/features/home/screen";
import { useHomeSnapshot } from "@/features/home/source";
import { DESKTOP_PROJECT_URL } from "@/features/home/text";

export default function Index() {
  const snapshot = useHomeSnapshot();
  return (
    <HomeScreen
      snapshot={snapshot}
      onGetDesktop={() => void Linking.openURL(DESKTOP_PROJECT_URL)}
    />
  );
}
