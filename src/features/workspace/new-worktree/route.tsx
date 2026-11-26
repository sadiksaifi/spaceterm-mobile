import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect } from "react";

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
  const machine = snapshot.machines.find((each) => each.id === machineId);
  const workspace = machine?.workspaces?.find((each) => each.id === workspaceId);
  const usable = machine?.connection === "connected" && workspace?.repository != null;
  const worktree = useNewWorktree({
    client,
    machineId,
    workspace: workspace ?? NONE,
    onCreated: () => router.back(),
  });

  // The form closes when its Workspace goes, or its Machine stops answering.
  useEffect(() => {
    if (!usable) router.back();
  }, [usable, router]);

  return (
    <NewWorktreeScreen
      worktree={{
        ...worktree,
        // Without the branch lists the form cannot be filled, so Cancel closes it.
        dismissFailure: () =>
          worktree.failure === "branches" ? router.back() : worktree.dismissFailure(),
      }}
      onClose={() => router.back()}
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
