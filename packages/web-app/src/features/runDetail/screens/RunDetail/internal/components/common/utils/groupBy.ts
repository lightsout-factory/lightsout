interface Params<T> {
	items: T[];
	/** The heading each item belongs under — its area, its folder, whatever the panel groups by. */
	getKey: (item: T) => string;
}

/** Keys keep insertion order on purpose: sorting would claim a ranking the run's evidence does not carry. */
export const groupBy = <T>({ items, getKey }: Params<T>): [string, T[]][] => {
	const groups = new Map<string, T[]>();

	for (const item of items) {
		const key = getKey(item);

		groups.set(key, [...(groups.get(key) ?? []), item]);
	}

	return [...groups];
};
