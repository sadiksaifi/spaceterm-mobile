/** Paths on a Machine as this device shows them, with `~` for the Machine's home directory. */

/**
 * An absolute path without a trailing slash, `/` for the root, with each `..` kept. Only the
 * Machine knows where `..` leads past a symbolic link, so the path it receives keeps them.
 */
export function expand(home: string, path: string): string {
  const trimmed = path.trim();
  const expanded = trimmed === "~" || trimmed.startsWith("~/") ? home + trimmed.slice(1) : trimmed;
  const parts = expanded.split("/").filter((part) => part !== "" && part !== ".");
  return `/${parts.join("/")}`;
}

/**
 * `expand` with each `..` taking away the name before it, as if no directory were a symbolic
 * link: right for the mock Machines, and for naming a Workspace after its directory.
 */
export function resolve(home: string, path: string): string {
  const parts: string[] = [];
  for (const part of expand(home, path).split("/")) {
    if (part === "") continue;
    if (part === "..") parts.pop();
    else parts.push(part);
  }
  return `/${parts.join("/")}`;
}

/** The directory above `absolute`, `null` for the root. Above a `..` is one more `..`. */
export function parent(absolute: string): string | null {
  if (absolute === "/") return null;
  if (basename(absolute) === "..") return join(absolute, "..");
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
