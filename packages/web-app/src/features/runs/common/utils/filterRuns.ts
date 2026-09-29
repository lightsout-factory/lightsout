import type { RunListing } from '@lightsout/engine';
import { runStatusFamilies } from '#src/common/constants/runStatusFamilies.ts';
import type { RunFilters } from '#src/features/runs/common/types/RunFilters.ts';
import { getRunCommand } from '#src/features/runs/common/utils/getRunCommand.ts';

interface Params {
	runs: RunListing[];
	filters: RunFilters;
}

export const filterRuns = ({ runs, filters }: Params): RunListing[] => {
	const text = filters.text?.toLowerCase();

	return runs.filter((run) => {
		const byCommand = filters.commands.length === 0 || filters.commands.includes(getRunCommand({ pipeline: run.pipeline }));
		const byStatus = filters.statuses.length === 0 || filters.statuses.includes(runStatusFamilies[run.status]);
		const byText = text === undefined || run.title.toLowerCase().includes(text);

		return byCommand && byStatus && byText;
	});
};
