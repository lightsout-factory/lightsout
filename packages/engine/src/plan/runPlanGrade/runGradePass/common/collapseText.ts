interface Params {
	text: string;
}

/** Agents re-type plan lines with different wrapping and casing, which mean nothing to the comparison. */
export const collapseText = ({ text }: Params): string => text.replace(/\s+/g, ' ').trim().toLowerCase();
