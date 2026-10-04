import type { QueueFailure } from '#src/queue/common/types/QueueFailure.ts';

interface Params {
	/** The raw config value, e.g. '4h'. */
	value: string;
	/** The config key the value came from, named verbatim in the failure message. */
	key: string;
}

// Deliberately narrow forms, so no two readers ever disagree about what a value means.
export const parseDurationMs = ({ value, key }: Params): number | QueueFailure => {
	const matched = /^(\d+)([smh])$/.exec(value.trim());
	const amount = Number(matched?.[1] ?? 0);

	if (matched === null || amount === 0) {
		return { error: `\`${key}\` must be a duration like '90s', '45m' or '4h' — got '${value}'` };
	}

	const perUnitMs = matched[2] === 's' ? 1000 : matched[2] === 'm' ? 60_000 : 3_600_000;

	return amount * perUnitMs;
};
