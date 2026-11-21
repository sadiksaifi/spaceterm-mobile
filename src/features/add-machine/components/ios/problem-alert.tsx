import { Alert, Button, Text } from "@expo/ui/swift-ui";
import type { ReactNode } from "react";

import { commandGuidance, inviteGuidance } from "@/shared/machines/text";

import type { InvitationProblem } from "../../flow";
import { text } from "../../text";

/**
 * Why an Invitation Link cannot pair, in the system alert, over `children`. A link that cannot be
 * used says how to get a new one; the alert sets the two paragraphs as plain text.
 */
export function ProblemAlert({
  problem,
  onDismiss,
  children,
}: {
  problem: InvitationProblem | null;
  onDismiss: () => void;
  children: ReactNode;
}) {
  return (
    <Alert
      title={
        problem === null
          ? ""
          : problem.kind === "unusable"
            ? text.unusableTitle
            : text.alreadyPairedTitle(problem.invitation.machineName)
      }
      isPresented={problem !== null}
      onIsPresentedChange={(shown) => !shown && problem !== null && onDismiss()}
    >
      <Alert.Trigger>{children}</Alert.Trigger>
      <Alert.Actions>
        <Button label={text.ok} onPress={onDismiss} />
      </Alert.Actions>
      {problem?.kind === "unusable" && (
        <Alert.Message>
          <Text>{`${inviteGuidance.join("")}\n${commandGuidance.join("")}`}</Text>
        </Alert.Message>
      )}
    </Alert>
  );
}
