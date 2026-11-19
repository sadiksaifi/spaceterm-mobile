import { useRouter } from "expo-router";
import { useState } from "react";

import { createZedCatalog } from "./catalog";
import { pickThemeFile } from "./pick-file";
import GetMoreScreen from "./screen";
import { useGetMore } from "./use-get-more";

/** Get More Themes: themes made for Zed, from Zed's extension store or from a file. */
export default function GetMoreRoute() {
  const router = useRouter();
  const [catalog] = useState(() => createZedCatalog());
  const page = useGetMore(catalog, pickThemeFile);
  return <GetMoreScreen page={page} onClose={() => router.back()} />;
}
