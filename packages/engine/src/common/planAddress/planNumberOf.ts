interface Params {
	/** A plan id, whose first three characters are its number. */
	id: string;
}

/**
 * An id the `PlanId` contract would refuse answers `NaN`, which compares false
 * against every number, so a caller ordering by it never silently accepts one.
 */
export const planNumberOf = ({ id }: Params): number => Number.parseInt(id.slice(0, 3), 10);
