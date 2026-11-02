import { runStatusFamilies } from '#src/common/constants/runStatusFamilies.ts';
import { SortDirection } from '#src/common/constants/SortDirection.ts';
import { RunCommand } from '#src/runs/common/constants/RunCommand.ts';
import { RunsSortKey } from '#src/runs/common/constants/RunsSortKey.ts';
import type { RunsSearch } from '#src/runs/parseRunsSearch/RunsSearch.ts';

/**
 * Narrower than `BadgeVariant`: a URL naming a severity or brand variant would
 * pass validation and then match no run. Deduplicated because the two paused
 * statuses share one family.
 */
const runStatusFamilyValues = [...new Set(Object.values(runStatusFamilies))];

const readList = <Option extends string>({ value, options }: { value: unknown; options: readonly Option[] }) => {
	const named = Array.isArray(value) ? value : [value];
	const kept = options.filter((option) => named.includes(option));

	return kept.length === 0 ? undefined : kept;
};

/** An empty string reads as absent, so a cleared box leaves no key behind. */
const readText = ({ value }: { value: unknown }) => (typeof value === 'string' && value !== '' ? value : undefined);

const readOption = <Option extends string>({ value, options }: { value: unknown; options: readonly Option[] }) => options.find((option) => option === value);

/** What the runs route accepts from a URL: a value outside its vocabularies is dropped, so it narrows nothing rather than everything. */
export const parseRunsSearch = (search: Record<string, unknown>): RunsSearch => ({
	commands: readList({ value: search.commands, options: Object.values(RunCommand) }),
	statuses: readList({ value: search.statuses, options: runStatusFamilyValues }),
	text: readText({ value: search.text }),
	sortKey: readOption({ value: search.sortKey, options: Object.values(RunsSortKey) }),
	sortDirection: readOption({ value: search.sortDirection, options: Object.values(SortDirection) }),
});
