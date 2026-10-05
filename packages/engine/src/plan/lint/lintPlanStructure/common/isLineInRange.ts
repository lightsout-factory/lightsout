interface Params {
	/** 1-based, as a plan's ranges are. */
	line: number;
	range?: { start: number; end: number };
}

export const isLineInRange = ({ line, range }: Params): boolean => range !== undefined && line >= range.start && line <= range.end;
