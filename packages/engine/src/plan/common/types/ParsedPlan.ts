import type { BuildMode } from '#src/common/constants/BuildMode.ts';
import type { LedgerRow } from '#src/contracts/plan/ledger/LedgerRow.ts';
import type { ProseFile } from '#src/contracts/plan/ledger/ProseFile.ts';
import type { RenameRule } from '#src/contracts/plan/renames/RenameRule.ts';
import type { PlanFileKind } from '#src/plan/common/constants/PlanFileKind.ts';

export interface ParsedPlan {
	base: string;
	title: string;
	variant: PlanFileKind;
	sections: Map<string, string[]>;
	createPaths: string[];
	modifyPaths: string[];
	/** Paths a prior phase creates, so absent from disk. */
	earlierPhaseModifyPaths: string[];
	deletePaths: string[];
	/**
	 * File moves only. A move heading that did not yield exactly two paths is in
	 * `malformedMoveLines` instead. After `expandFolderMoves`, it also holds the
	 * file moves each folder move carries.
	 */
	movePaths: { from: string; to: string }[];
	/** The folder moves from `## Files to Move`, with the trailing `/` stripped; `expandFolderMoves` appends the files each one carries to `movePaths`. */
	folderMoves: { from: string; to: string }[];
	malformedMoveLines: number[];
	/** 1-based inclusive line ranges, keyed by heading. */
	generatedRegionRanges: Map<string, { start: number; end: number }>;
	decisionLogRange?: { start: number; end: number };
	/** 1-based inclusive: the heading line through the last line before the next `##`. */
	sectionRanges: Map<string, { start: number; end: number }>;
	/** Absent when the plan takes the configured default. */
	fileBudget?: number;
	/** Decided once by `parsePlan`; every reader switches on it rather than inferring the mode from `renames`. */
	buildMode: BuildMode;
	/** In declared order, the order the build applies them in. */
	renames: RenameRule[];
	malformedRenameLines: number[];
	mirrorPaths: string[];
	verificationCommands: string[];
	ledger: LedgerRow[];
	malformedLedgerLines: number[];
	proseFiles: ProseFile[];
	malformedProseLines: number[];
	lines: string[];
}
