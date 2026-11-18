import { openBrowserAsync } from "expo-web-browser";

import HomeScreen from "./screen";
import { useHomeSnapshot } from "./source";

const DESKTOP_PROJECT_URL = "https://github.com/sadiksaifi/spaceterm";

/** Home as a route: what this device knows, and the actions that exist so far. */
export default function HomeRoute() {
  const snapshot = useHomeSnapshot();
  return (
    <HomeScreen
      snapshot={snapshot}
      // The page opens inside the app. If it cannot open, the person stays on Home.
      onGetDesktop={() => void openBrowserAsync(DESKTOP_PROJECT_URL).catch(() => {})}
    />
  );
}
