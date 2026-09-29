import type { StandardsFinding } from '@lightsout/engine';
import type { FolderGroup } from '#src/features/standards/internal/common/types/FolderGroup.ts';
import { getFindingFolder } from '#src/features/standards/internal/common/utils/getFindingFolder.ts';

interface Params {
	findings: StandardsFinding[];
	depth: number;
}

export const groupFindingsByFolder = ({ findings, depth }: Params): FolderGroup[] => {
	const byFolder = new Map<string, Map<string, number>>();

	for (const finding of findings) {
		const folder = getFindingFolder({ finding, depth });
		const rules = byFolder.get(folder) ?? new Map<string, number>();

		rules.set(finding.rule, (rules.get(finding.rule) ?? 0) + 1);
		byFolder.set(folder, rules);
	}

	return [...byFolder]
		.map(([folder, rules]) => ({
			folder,
			count: [...rules.values()].reduce((total, count) => total + count, 0),
			rules: [...rules].map(([rule, count]) => ({ rule, count })).sort((first, second) => second.count - first.count || first.rule.localeCompare(second.rule)),
		}))
		.sort((first, second) => second.count - first.count || first.folder.localeCompare(second.folder));
};
