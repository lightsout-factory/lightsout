import type { RunListing } from '@lightsout/engine';
import { useEffect, useRef, useState } from 'react';
import { FilterDropdown } from '#src/appUI/FilterDropdown.tsx';
import { BadgeVariant } from '#src/common/constants/BadgeVariant.ts';
import { runStatusFamilies } from '#src/common/constants/runStatusFamilies.ts';
import type { RunFilters } from '#src/features/runs/common/types/RunFilters.ts';
import { getRunCommand } from '#src/features/runs/common/utils/getRunCommand.ts';

/** Only the neutral family needs its own word: it is what a run that has not started yet wears. */
const familyLabels: Partial<Record<BadgeVariant, string>> = { [BadgeVariant.Neutral]: 'pending' };

const countValues = <TValue extends string>({ values }: { values: TValue[] }) => {
	const counts = new Map<TValue, number>();

	for (const value of values) {
		counts.set(value, (counts.get(value) ?? 0) + 1);
	}

	return [...counts].map(([value, count]) => ({ value, count }));
};

interface Props {
	/** The unfiltered rows, so the options are the whole vocabulary rather than the current selection. */
	runs: RunListing[];
	filters: RunFilters;
	onChange: (filters: RunFilters) => void;
}

/**
 * The text box keeps its own value and reports it 250ms after the last
 * keystroke, so the URL is written once per pause rather than per character. A
 * dropdown reports at once and carries the typed text with it, since the
 * pending report is dropped.
 */
export const RunsFilterBar = ({ runs, filters, onChange }: Props) => {
	const [text, setText] = useState(filters.text ?? '');
	const pending = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
	const commands = countValues({ values: runs.map((run) => getRunCommand({ pipeline: run.pipeline })) });
	const statuses = countValues({ values: runs.map((run) => runStatusFamilies[run.status]) });

	useEffect(() => () => clearTimeout(pending.current), []);

	const change = ({ next }: { next: RunFilters }) => {
		clearTimeout(pending.current);
		onChange({ ...next, text: text === '' ? undefined : text });
	};

	const changeText = ({ value }: { value: string }) => {
		setText(value);
		clearTimeout(pending.current);
		pending.current = setTimeout(() => onChange({ ...filters, text: value === '' ? undefined : value }), 250);
	};

	return (
		<div className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-card p-3">
			<FilterDropdown
				label="command"
				options={commands.map(({ value, count }) => ({ value, label: value, count }))}
				selected={filters.commands}
				onChange={(selected) => change({ next: { ...filters, commands: selected } })}
			/>
			<FilterDropdown
				label="status"
				options={statuses.map(({ value, count }) => ({ value, label: familyLabels[value] ?? value, count }))}
				selected={filters.statuses}
				onChange={(selected) => change({ next: { ...filters, statuses: selected } })}
			/>
			<input
				type="search"
				aria-label="Filter runs by title"
				placeholder="Filter by title"
				value={text}
				onChange={(event) => changeText({ value: event.target.value })}
				className="h-8 min-w-0 flex-1 rounded-md border border-border bg-background px-2 text-sm outline-none focus-visible:border-ring"
			/>
		</div>
	);
};
