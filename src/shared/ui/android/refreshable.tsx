import { PullToRefreshBox } from "@expo/ui/jetpack-compose";
import { fillMaxSize, type ModifierConfig } from "@expo/ui/jetpack-compose/modifiers";
import { useState, type ReactNode } from "react";

/**
 * Pull to refresh around one scrolling list. The indicator shows until `onRefresh` settles.
 * Without `onRefresh` the list only scrolls. `modifiers` place the box, which fills its parent
 * unless they say otherwise; the list inside fills the box.
 */
export function Refreshable({
  onRefresh,
  modifiers = [fillMaxSize()],
  children,
}: {
  onRefresh: (() => Promise<void>) | undefined;
  modifiers?: ModifierConfig[];
  children: ReactNode;
}) {
  const [refreshing, setRefreshing] = useState(false);
  if (onRefresh === undefined) return children;
  return (
    <PullToRefreshBox
      isRefreshing={refreshing}
      onRefresh={() => {
        if (refreshing) return;
        setRefreshing(true);
        void onRefresh()
          .catch(() => {})
          .finally(() => setRefreshing(false));
      }}
      modifiers={modifiers}
    >
      {children}
    </PullToRefreshBox>
  );
}
