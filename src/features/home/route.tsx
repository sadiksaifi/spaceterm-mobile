import { Linking } from "react-native";

import HomeScreen from "./screen";
import { useHomeSnapshot } from "./source";

const DESKTOP_PROJECT_URL = "https://github.com/sadiksaifi/spaceterm";

/** Home as a route: what this device knows, and the actions that exist so far. */
export default function HomeRoute() {
  const snapshot = useHomeSnapshot();
  return (
    <HomeScreen
      snapshot={snapshot}
      onGetDesktop={() => void Linking.openURL(DESKTOP_PROJECT_URL)}
    />
  );
}
