import { expect, it } from "vitest";

import { invitationLinkIn } from "./invitation";

it("finds an Invitation Link in copied text, around the spaces a copy can bring", () => {
  expect(invitationLinkIn("  spaceterm://pair/abc123\n")).toBe("spaceterm://pair/abc123");
});

it("finds none in other text, or in the start of a link alone", () => {
  expect(invitationLinkIn("")).toBeNull();
  expect(invitationLinkIn("https://example.com/pair/abc123")).toBeNull();
  expect(invitationLinkIn("spaceterm://pair/")).toBeNull();
});
