interface Params {
	/** Whatever was caught — JavaScript allows throwing any value, not just an Error. */
	error: unknown;
}

export const messageOf = ({ error }: Params): string => (error instanceof Error ? error.message : String(error));
