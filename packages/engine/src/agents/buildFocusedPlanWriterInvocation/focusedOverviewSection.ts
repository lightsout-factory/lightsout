interface Params {
	path: string;
}

export const focusedOverviewSection = ({ path }: Params): string =>
	`## Overview only

Author \`${path}\` and nothing else — not one phase file. A separate agent authors each phase file from the breakdown you write here, all of them at once, and none of them ever reads another phase's file. A phase you do not declare is never written.

That makes the breakdown load-bearing rather than decorative. It reaches the phase writers as two views of one record:

- \`## Phases\` — one row per phase, carrying its number, its \`phase<N>-<slug>.md\` filename, a one-line scope, and integer \`Creates\` and \`Touches\` counts. Numbers run 1..n with no gaps.
- \`## Phase Declarations\` — one \`### Phase <N> — \` block per row, listing ONLY what crosses a phase boundary: the files a later phase builds against, the exported names later phases import, and the package scripts that phase adds. Write \`none\` for a bullet with nothing to declare.

State each phase once — its scope and counts in its row, its cross-boundary names in its block. The engine normalises the number-and-filename pairing across the two views before the lint runs, so reconciling a row against its block by hand is not your work, and a disagreement between them is never a reason to renumber.

The counts are your estimate; the engine recomputes them from the finished phase files afterwards. The declarations are not an estimate — a phase writer is held to them.

Report only this file in \`filesWritten\`.`;
