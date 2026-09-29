import { readdir } from 'node:fs/promises';
import { StandardsSeverity } from '#src/contracts/standardsCheck/StandardsSeverity.ts';
import type { StandardsTrendPoint } from '#src/contracts/views/StandardsTrendPoint.ts';
import { getStandardsSnapshotsDir } from '#src/standardsCheck/internal/common/paths/getStandardsSnapshotsDir.ts';
import { readStandardsSnapshot } from '#src/standardsCheck/readStandardsSnapshot.ts';

interface Params {
	cwd: string;
}

/** A file that will not parse is skipped in silence: one corrupt snapshot must not take the whole trend down with it. */
export const listStandardsSnapshots = async ({ cwd }: Params): Promise<StandardsTrendPoint[]> => {
	const entries = await readdir(getStandardsSnapshotsDir({ cwd })).catch(() => []);
	const points: StandardsTrendPoint[] = [];

	for (const fileName of entries.filter((entry) => entry.endsWith('.json'))) {
		const snapshot = await readStandardsSnapshot({ cwd, fileName });

		if (snapshot === undefined) {
			continue;
		}

		const counts = new Map<string, number>();

		for (const finding of snapshot.findings) {
			counts.set(finding.rule, (counts.get(finding.rule) ?? 0) + 1);
		}

		points.push({
			at: snapshot.at,
			path: snapshot.path,
			total: snapshot.findings.length,
			blocking: snapshot.findings.filter((finding) => finding.severity === StandardsSeverity.Blocking).length,
			advisory: snapshot.findings.filter((finding) => finding.severity === StandardsSeverity.Advisory).length,
			byRule: [...counts.entries()].map(([rule, count]) => ({ rule, count })).sort((first, second) => first.rule.localeCompare(second.rule)),
		});
	}

	return points.sort((first, second) => first.at.localeCompare(second.at));
};
