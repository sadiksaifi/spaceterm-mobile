/** Paths on a Machine as this device shows them, with `~` for the Machine's home directory. */

/** An absolute path without a trailing slash, `/` for the root. */
export function resolve(home: string, path: string): string {
  const trimmed = path.trim();
  const expanded = trimmed === "~" || trimmed.startsWith("~/") ? home + trimmed.slice(1) : trimmed;
  const parts: string[] = [];
  for (const part of expanded.split("/")) {
    if (part === "" || part === ".") continue;
    if (part === "..") parts.pop();
    else parts.push(part);
  }
  return `/${parts.join("/")}`;
}

export function parent(absolute: string): string | null {
  if (absolute === "/") return null;
  const cut = absolute.lastIndexOf("/");
  return cut === 0 ? "/" : absolute.slice(0, cut);
}

export function join(absolute: string, name: string): string {
  return absolute === "/" ? `/${name}` : `${absolute}/${name}`;
}

export function basename(absolute: string): string {
  return absolute === "/" ? "/" : absolute.slice(absolute.lastIndexOf("/") + 1);
}

/** The path as the Machine shows it: `~` for the home directory, a trailing slash for a listing. */
export function display(home: string, absolute: string, trailingSlash: boolean): string {
  const shown =
    absolute === home
      ? "~"
      : absolute.startsWith(`${home}/`)
        ? `~${absolute.slice(home.length)}`
        : absolute;
  if (!trailingSlash || shown === "/") return shown;
  return `${shown}/`;
}
