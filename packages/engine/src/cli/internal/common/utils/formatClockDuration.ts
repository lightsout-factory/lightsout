interface Params {
	ms?: number;
}

/**
 * Separate from `formatDuration` because that one drops the minutes under a
 * minute (`5s`), which breaks a fixed-width column.
 */
export const formatClockDuration = ({ ms }: Params): string => {
	if (ms === undefined) {
		return '—';
	}

	const seconds = Math.round(ms / 1000);

	return `${Math.floor(seconds / 60)}m ${String(seconds % 60).padStart(2, '0')}s`;
};
