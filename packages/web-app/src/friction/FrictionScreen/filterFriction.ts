import type { FrictionArea, FrictionRecord } from '@lightsout/engine';

interface Params {
	records: FrictionRecord[];
	/** Areas to keep; empty means no area filter rather than no rows. */
	areas: FrictionArea[];
	/** Matched against the entry's own words, case-insensitively. */
	text?: string;
}

/**
 * The text match reads only `detail` and `kind`, never the run title joined in
 * for display, so a filter typed before the runs query lands narrows the same
 * rows it will narrow afterwards.
 */
export const filterFriction = ({ records, areas, text }: Params): FrictionRecord[] => {
	const needle = text?.trim().toLowerCase() ?? '';

	return records.filter((record) => {
		const matchesArea = areas.length === 0 || areas.includes(record.area);
		const matchesText = needle === '' || `${record.detail} ${record.kind ?? ''}`.toLowerCase().includes(needle);

		return matchesArea && matchesText;
	});
};
