import { useFocusEffect, useLocalSearchParams, useNavigation, useRouter } from "expo-router";
import { useCallback, useRef } from "react";

import { useMachineClient, useMachines } from "@/shared/machines/client";
import type { Workspace } from "@/shared/machines/model";

import NewWorktreeScreen from "./screen";
import { useNewWorktree } from "./use-new-worktree";

type Params = { machineId: string; workspaceId: string };

/** New Worktree for a Workspace in a repository, over its Tabs. */
export default function NewWorktreeRoute() {
  const { machineId, workspaceId } = useLocalSearchParams<Params>();
  const snapshot = useMachines();
  const client = useMachineClient();
  const router = useRouter();
  const navigation = useNavigation();
  // Closing goes back once, and only from the form: Close and a Create that answers as the form
  // closes would otherwise each go back, and take the Workspace with it.
  const closed = useRef(false);
  const close = () => {
    if (closed.current || !navigation.isFocused()) return;
    closed.current = true;
    router.back();
  };
  const machine = snapshot.machines.find((each) => each.id === machineId);
  const workspace = machine?.workspaces?.find((each) => each.id === workspaceId);
  const usable = machine?.connection === "connected" && workspace?.repository != null;
  const worktree = useNewWorktree({
    client,
    machineId,
    workspace: workspace ?? NONE,
    onCreated: close,
  });

  // The form closes when its Workspace goes, or its Machine stops answering, or as soon as it is
  // on screen again if that happened under another screen.
  useFocusEffect(
    useCallback(() => {
      if (!usable) close();
      // `close` is new each render; what matters is `usable` while the form is on screen.
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [usable]),
  );

  return (
    <NewWorktreeScreen
      worktree={{
        ...worktree,
        // Without the branch lists the form cannot be filled, so Cancel closes it.
        dismissFailure: () =>
          worktree.failure === "branches" ? close() : worktree.dismissFailure(),
      }}
      onClose={close}
    />
  );
}

const NONE: Workspace = {
  id: "",
  name: "",
  directory: "",
  terminalSessions: 0,
  tabs: [],
  repository: null,
};
