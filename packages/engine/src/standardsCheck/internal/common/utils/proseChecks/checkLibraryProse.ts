import { dirname, join } from 'node:path';
import type { LoadedStandardsLibrary } from '#src/common/types/LoadedStandardsLibrary.ts';
import { findBrokenLinks } from '#src/standardsCheck/internal/common/utils/proseChecks/findBrokenLinks.ts';

interface Params {
	library: LoadedStandardsLibrary;
}

/** Headings name a rule; only the lines under them tell an agent what to do. */
const hasInstructions = ({ prose }: { prose: string }) => prose.split('\n').some((line) => line.trim().length > 0 && !/^ {0,3}#{1,6}(\s|$)/.test(line));

/**
 * What an agent reads is the prose, so a rule with none is a rule no agent is
 * told about, and a link to a file that is gone sends every reader nowhere.
 * Loading accepts both — a library is still usable — so this is where they are
 * named.
 */
export const checkLibraryProse = ({ library }: Params): string[] => {
	const problems: string[] = [];

	for (const rule of library.rules) {
		if (!hasInstructions({ prose: rule.prose })) {
			problems.push(`${rule.id}: rule.md has no prose under its heading — agents read the prose, so they are never told this rule`);
		}

		for (const target of findBrokenLinks({ text: rule.prose, fromFolder: dirname(rule.fixturesPath) })) {
			problems.push(`${rule.id}: rule.md links to ${target}, which does not exist`);
		}
	}

	for (const topic of library.documents) {
		for (const target of findBrokenLinks({ text: topic.intro, fromFolder: join(library.rootPath, 'rules', topic.path) })) {
			problems.push(`${topic.path}: topic.md links to ${target}, which does not exist`);
		}
	}

	return problems;
};
