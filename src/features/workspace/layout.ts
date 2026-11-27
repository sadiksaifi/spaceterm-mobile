import type { Pane } from "@/shared/machines/model";

/**
 * How a Tab's Panes split its card: one Pane, or two parts side by side (`row`) or one above the
 * other (`column`), each taking half.
 */
export type Split =
  | { kind: "pane"; pane: Pane }
  | { kind: "split"; axis: "row" | "column"; first: Split; second: Split };

/**
 * The split every client draws without a saved arrangement, as SpaceTerm Core derives it: each
 * Pane after the first halves the Pane it was placed beside, on its side. A Pane whose source is
 * gone halves the first Pane.
 */
export function splitOf(panes: readonly Pane[]): Split | null {
  const [first, ...rest] = panes;
  if (first === undefined) return null;
  let tree: Split = { kind: "pane", pane: first };
  for (const pane of rest) {
    const beside = pane.source !== null && contains(tree, pane.source) ? pane.source : first.id;
    tree = replace(tree, beside, (leaf) => {
      const added: Split = { kind: "pane", pane };
      const axis = pane.side === "right" || pane.side === "left" ? "row" : "column";
      const before = pane.side === "left" || pane.side === "up";
      return before
        ? { kind: "split", axis, first: added, second: leaf }
        : { kind: "split", axis, first: leaf, second: added };
    });
  }
  return tree;
}

function contains(tree: Split, id: string): boolean {
  return tree.kind === "pane"
    ? tree.pane.id === id
    : contains(tree.first, id) || contains(tree.second, id);
}

function replace(tree: Split, id: string, change: (leaf: Split) => Split): Split {
  if (tree.kind === "pane") return tree.pane.id === id ? change(tree) : tree;
  return {
    ...tree,
    first: replace(tree.first, id, change),
    second: replace(tree.second, id, change),
  };
}
