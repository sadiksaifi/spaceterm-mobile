import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useState } from "react";

import { useMachineClient, useMachines } from "@/shared/machines/client";
import { invitationLinkIn } from "@/shared/machines/invitation";

import { pastedInvitationLink, useAddMachineFlow } from "../flow";
import LinkStepScreen from "./screen";

/**
 * The Invitation Link to pair with, from the clipboard or a `spaceterm://pair` link, with the
 * Machine it names. The link holds a secret, so it stays hidden.
 */
export default function LinkStepRoute() {
  const params = useLocalSearchParams<{ link?: string | string[]; delivery?: string | string[] }>();
  // A link from another app can name a parameter twice; the first one counts.
  const given = first(params.link) ?? "";
  const delivery = first(params.delivery) ?? "";
  const client = useMachineClient();
  // A Machine paired or unpaired meanwhile changes what the link says.
  useMachines();
  const flow = useAddMachineFlow();
  const router = useRouter();
  // `typed` is true once the person types in the field; until then the link came from elsewhere.
  const [field, setField] = useState({ link: given, version: 0, typed: false, delivery, form: 0 });
  const [networkAddress, setNetworkAddress] = useState("");

  // Another delivery while this step shows, even of the same link, replaces the whole form.
  if (delivery !== field.delivery) {
    setField({
      link: given,
      version: field.version + 1,
      typed: false,
      delivery,
      form: field.form + 1,
    });
    setNetworkAddress("");
  }

  // The flow can open on this step, from No Machines or another app; Back still reaches the camera.
  const { cameraBeneath } = flow;
  useEffect(() => cameraBeneath(), [cameraBeneath]);

  // Typed text is read once it is a whole Invitation Link. A link from a scan, a paste or another
  // app is read as it is, so text that is no link at all says it cannot be used.
  const link = field.typed ? invitationLinkIn(field.link) : field.link.trim() || null;
  const reading = link === null ? null : client.readInvitation(link);
  // A paste started before another delivery arrived would overwrite the newer link, so it is dropped.
  const replace = (next: string, form = field.form) =>
    setField((current) =>
      current.form === form
        ? { ...current, link: next, version: current.version + 1, typed: false }
        : current,
    );

  return (
    <LinkStepScreen
      link={field.link}
      fieldVersion={field.version}
      formVersion={field.form}
      typed={field.typed}
      reading={reading}
      onEditLink={(edited) => setField((current) => ({ ...current, link: edited, typed: true }))}
      // A clipboard without an Invitation Link leaves the field as it is.
      onPaste={() => {
        const form = field.form;
        void pastedInvitationLink().then((pasted) => pasted !== null && replace(pasted, form));
      }}
      onDismissProblem={() => replace("")}
      onEditNetworkAddress={setNetworkAddress}
      onJoin={
        link !== null && reading?.kind === "invitation"
          ? () =>
              flow.startPairing({
                link,
                machineName: reading.invitation.machineName,
                networkAddress: networkAddress.trim() === "" ? null : networkAddress.trim(),
              })
          : undefined
      }
      onBack={() => router.back()}
    />
  );
}

function first(param: string | string[] | undefined): string | undefined {
  return Array.isArray(param) ? param[0] : param;
}
