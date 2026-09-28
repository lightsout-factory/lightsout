interface Params {
	/** What a standards command printed, holding one table whose last row counts the rules. */
	stdout: string;
}

/** The number printed before `label` on the totals row, or undefined when the row does not carry it. */
const countBefore = ({ row, label }: { row: string; label: string }) => {
	const match = new RegExp(`(\\d+) ${label}`).exec(row);

	return match === null ? undefined : Number(match[1]);
};

/**
 * The totals row of a standards table, read into numbers — so a test can say
 * the counts add up without pinning how many rules the pack holds today, which
 * changes every time a rule is written or removed.
 *
 * @param stdout - the command's output
 */
export const readRuleTotals = ({ stdout }: Params) => {
	const row = stdout.split('\n').find((line) => /│ \d+ rule\(s\)/.test(line)) ?? '';

	return {
		rules: countBefore({ row, label: 'rule\\(s\\)' }),
		blocking: countBefore({ row, label: 'blocking' }),
		advisory: countBefore({ row, label: 'advisory' }),
		off: countBefore({ row, label: 'off' }),
		code: countBefore({ row, label: 'by code' }),
		judgment: countBefore({ row, label: 'by judgment' }),
	};
};
