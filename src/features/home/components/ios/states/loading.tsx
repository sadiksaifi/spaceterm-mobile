import { ProgressView, Text, VStack } from "@expo/ui/swift-ui";
import { font, textCase } from "@expo/ui/swift-ui/modifiers";

import { secondary } from "@/shared/ui/ios/modifiers";

import { text } from "../../../text";
import { Centered } from "./layout";

export function Loading() {
  return (
    <Centered extraBottom={60}>
      <VStack spacing={8} modifiers={[secondary]}>
        <ProgressView />
        <Text modifiers={[textCase("uppercase"), font({ textStyle: "caption" })]}>
          {text.loading}
        </Text>
      </VStack>
    </Centered>
  );
}
