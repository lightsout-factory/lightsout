import type { BuildMode } from '#src/common/constants/BuildMode.ts';

/**
 * Only the work that crosses a phase boundary: the phase file holds the
 * complete file list, and repeating it here would create two lists that drift.
 * This exists so phase agents can author concurrently before any phase file is
 * on disk, and so the size check can run before any of them is paid for.
 */
export interface PhaseDeclaration {
	/** 1-based phase number, from the `## Phases` table's first column. */
	number: number;
	/** The phase file's basename, e.g. `phase1-lint-vocabulary.md`. */
	file: string;
	/** The one-line scope from the `## Phases` table. */
	scope: string;
	/** Declared count of source files this phase creates; undefined when the table cell is missing or not an integer. */
	createdCount?: number;
	/** Declared count of source files this phase touches in any way; undefined when the table cell is missing or not an integer. */
	touchedCount?: number;
	/** Repo-relative paths this phase creates that a later phase builds against. */
	creates: string[];
	/** Exported symbol names later phases import. */
	exports: string[];
	/** package.json script names this phase adds. */
	scripts: string[];
	/** The phase's declared `## File Budget`, absent when it takes the configured default. */
	fileBudget?: number;
	/** Present only for a mechanical phase: the one mode bullet its declaration block reads `yes` on. Omitted for a standard phase, as optional declaration fields are. */
	buildMode?: Exclude<BuildMode, typeof BuildMode.Standard>;
	/** Present and `true` only when the block reads `yes` on both mode bullets; `buildMode` is then omitted, because guessing which one wins would hide the drafting mistake. */
	buildModeConflict?: boolean;
	/** 1-based line of this phase's row in the overview's `## Phases` table; absent for a declaration block with no matching row. */
	rowLine?: number;
	/** 1-based inclusive line range of this phase's `### Phase <N>` block; absent for a table row with no matching block. */
	blockRange?: { start: number; end: number };
}
