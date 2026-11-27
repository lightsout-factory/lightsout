import type { CleanupSummary } from '#src/common/types/CleanupSummary.ts';

interface Params {
	cleanup: CleanupSummary;
}

/**
 * The texts printed beneath the cleanup line, unindented: each renderer indents them under its own label column.
 * A first round can be earned by advisories alone, so a cleanup handed no blocking finding never reads as one that did nothing.
 */
export const describeCleanupDetail = ({ cleanup }: Params): string[] => {
	const shownSites = 5;
	const texts: string[] = [];

	if (cleanup.targetedFindings === 0) {
		texts.push('no blocking findings handed to cleanup');
	} else if (cleanup.targetedFindings !== undefined) {
		texts.push(`found ${cleanup.targetedFindings} · fixed ${cleanup.fixedFindings ?? 0}`);
	}

	for (const site of cleanup.remainingSites.slice(0, shownSites)) {
		texts.push(`remaining ${site.rule} — ${site.files.join(', ')}`);
	}

	if (cleanup.remainingSites.length > shownSites) {
		texts.push(`+${cleanup.remainingSites.length - shownSites} more remaining`);
	}

	return texts;
};
