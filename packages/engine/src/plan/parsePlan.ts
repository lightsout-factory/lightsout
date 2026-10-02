import { BuildMode } from '#src/common/constants/BuildMode.ts';
import type { RenameRule } from '#src/contracts/plan/renames/RenameRule.ts';
import { generatedPlanRegions } from '#src/plan/internal/common/constants/generatedPlanRegions.ts';
import { PlanFileKind } from '#src/plan/internal/common/constants/PlanFileKind.ts';
import { parseAcceptanceLedger } from '#src/plan/internal/common/parsing/parseAcceptanceLedger.ts';
import { parseProseFiles } from '#src/plan/internal/common/parsing/parseProseFiles.ts';
import { parseRenames } from '#src/plan/internal/common/parsing/parseRenames.ts';
import { pathFromLine } from '#src/plan/internal/common/paths/pathFromLine.ts';
import { pathPairFromLine } from '#src/plan/internal/common/paths/pathPairFromLine.ts';
import type { ParsedPlan } from '#src/plan/internal/common/types/ParsedPlan.ts';
import { planCreatePaths } from '#src/plan/internal/planCreatePaths.ts';

/**
 * Each section carries its 1-based first line, so a section's own reader can
 * report a defect by a location a human can jump to.
 */
const parseSections = ({ lines }: { lines: string[] }) => {
	const sections = new Map<string, { lines: string[]; firstLine: number }>();
	let current: string | undefined;

	for (const [index, line] of lines.entries()) {
		const heading = /^##\s+(.+?)\s*$/.exec(line);

		if (heading) {
			current = heading[1];
			sections.set(current, { lines: [], firstLine: index + 2 });

			continue;
		}

		if (current !== undefined) {
			sections.get(current)?.lines.push(line);
		}
	}

	return sections;
};

/**
 * Blank lines up to the next `##` are included, so the rewriter can replace the
 * whole span and write exactly one blank line back.
 */
const rangeOf = ({ section }: { section: { lines: string[]; firstLine: number } }) => ({
	start: section.firstLine - 1,
	end: section.firstLine - 1 + section.lines.length,
});

const pathsFromLines = ({ sectionLines, lineMatches }: { sectionLines: string[] | undefined; lineMatches: (line: string) => boolean }) => {
	if (!sectionLines) {
		return [];
	}

	const paths: string[] = [];

	for (const line of sectionLines) {
		if (lineMatches(line)) {
			const path = pathFromLine({ line });

			if (path) {
				paths.push(path);
			}
		}
	}

	return paths;
};

const commandsFromVerification = ({ sectionLines }: { sectionLines: string[] | undefined }): string[] => {
	if (!sectionLines) {
		return [];
	}

	const commands: string[] = [];

	for (const line of sectionLines) {
		if (!/^\s*-\s+/.test(line)) {
			continue;
		}

		const span = /`([^`]+)`/.exec(line);

		if (span) {
			commands.push(span[1].trim());
		}
	}

	return commands;
};

/**
 * A heading naming fewer than two paths is recorded by line number, so the lint
 * reports it rather than losing a file the plan meant to move. Scanned over the
 * whole file because that line number is the finding's location.
 */
const movesFromPlan = ({ lines }: { lines: string[] }) => {
	const moves: { from: string; to: string }[] = [];
	const malformedLines: number[] = [];
	let inMoveSection = false;

	for (const [index, line] of lines.entries()) {
		const heading = /^##\s+(.+?)\s*$/.exec(line);

		if (heading) {
			inMoveSection = heading[1] === 'Files to Move';

			continue;
		}

		if (!inMoveSection || !/^###\s+/.test(line)) {
			continue;
		}

		const pair = pathPairFromLine({ line });

		if (pair) {
			moves.push(pair);
		} else {
			malformedLines.push(index + 1);
		}
	}

	return { moves, malformedLines };
};

/**
 * A region the file lacks gets no entry: an invented empty span would read to
 * the section writers as a section to replace rather than one to insert.
 */
const generatedRangesFrom = ({ parsed }: { parsed: Map<string, { lines: string[]; firstLine: number }> }) => {
	const ranges = new Map<string, { start: number; end: number }>();

	for (const heading of Object.values(generatedPlanRegions)) {
		const section = parsed.get(heading);

		if (section !== undefined) {
			ranges.set(heading, rangeOf({ section }));
		}
	}

	return ranges;
};

const fileBudgetFrom = ({ sectionLines }: { sectionLines: string[] | undefined }) => {
	for (const line of sectionLines ?? []) {
		const match = /(\d+)/.exec(line);

		if (match) {
			return Number(match[1]);
		}
	}

	return undefined;
};

/**
 * A `## Build Mode` section outranks a `## Renames` one, and only the exact
 * literal names the mode: anything else in that section is left for the lint
 * to report rather than guessed at here.
 */
const buildModeFrom = ({ sectionLines, renames }: { sectionLines: string[] | undefined; renames: RenameRule[] }) => {
	const declared = (sectionLines ?? [])
		.find((line) => line.trim() !== '')
		?.trim()
		.replace(/^`(.*)`$/, '$1');
	let buildMode: BuildMode = BuildMode.Standard;

	if (declared === BuildMode.MoveFoldersAndFiles) {
		buildMode = BuildMode.MoveFoldersAndFiles;
	} else if (renames.length > 0) {
		buildMode = BuildMode.RenamesOnly;
	}

	return buildMode;
};

interface Params {
	content: string;
	/** The plan file's basename — `overview.md` is one of the overview-variant signals. */
	base: string;
}

export const parsePlan = ({ content, base }: Params): ParsedPlan => {
	const lines = content.split('\n');
	const parsed = parseSections({ lines });
	const sections = new Map<string, string[]>([...parsed].map(([heading, section]) => [heading, section.lines]));
	const generatedRegionRanges = generatedRangesFrom({ parsed });
	const ledgerSection = parsed.get('Acceptance Tests');
	const proseSection = parsed.get('Prose Files');
	const renamesSection = parsed.get('Renames');
	const ledger = parseAcceptanceLedger({ sectionLines: ledgerSection?.lines, firstLine: ledgerSection?.firstLine ?? 1 });
	const prose = parseProseFiles({ sectionLines: proseSection?.lines, firstLine: proseSection?.firstLine ?? 1 });
	const renamed = parseRenames({ sectionLines: renamesSection?.lines, firstLine: renamesSection?.firstLine ?? 1 });
	const title =
		lines
			.find((line) => /^#\s+/.test(line))
			?.replace(/^#\s+/, '')
			.trim() ?? '';
	const variant =
		base === 'overview.md' || (sections.has('Phases') && sections.has('Cross-Phase Dependencies')) || /—\s*Overview\s*$/.test(title)
			? PlanFileKind.Overview
			: PlanFileKind.Implementable;
	const isSubheading = (line: string) => /^###\s+/.test(line);
	const { moves, malformedLines } = movesFromPlan({ lines });

	return {
		base,
		title,
		variant,
		sections,
		createPaths: planCreatePaths({ planText: content }),
		modifyPaths: pathsFromLines({ sectionLines: sections.get('Files to Modify'), lineMatches: isSubheading }),
		earlierPhaseModifyPaths: pathsFromLines({ sectionLines: sections.get('Files to Modify from Earlier Phases'), lineMatches: isSubheading }),
		deletePaths: pathsFromLines({ sectionLines: sections.get('Files to Delete'), lineMatches: isSubheading }),
		movePaths: moves,
		malformedMoveLines: malformedLines,
		generatedRegionRanges,
		decisionLogRange: generatedRegionRanges.get(generatedPlanRegions.decisionLog),
		sectionRanges: new Map([...parsed].map(([heading, section]) => [heading, rangeOf({ section })])),
		fileBudget: fileBudgetFrom({ sectionLines: sections.get('File Budget') }),
		buildMode: buildModeFrom({ sectionLines: sections.get('Build Mode'), renames: renamed.renames }),
		renames: renamed.renames,
		malformedRenameLines: renamed.malformedLines,
		mirrorPaths: pathsFromLines({ sectionLines: sections.get('Patterns to Mirror'), lineMatches: (line) => /^\s*-\s+/.test(line) }),
		verificationCommands: commandsFromVerification({ sectionLines: sections.get('Verification') }),
		ledger: ledger.rows,
		malformedLedgerLines: ledger.malformedLines,
		proseFiles: prose.files,
		malformedProseLines: prose.malformedLines,
		lines,
	};
};
