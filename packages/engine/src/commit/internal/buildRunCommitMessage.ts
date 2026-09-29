interface Params {
	/** The subject line, already addressed. */
	subject: string;
	/** The agent's body, placed between the subject and the trailer lines. Blank or whitespace-only is treated as absent. */
	body?: string;
	unit?: string;
	runId?: string;
}

/**
 * The one place a commit message is assembled, so every commit point carries the
 * same shape. The run trailer is what makes a commit searchable back to its evidence.
 */
export const buildRunCommitMessage = ({ subject, body, unit, runId }: Params): string => {
	const prose = body?.trim() ?? '';
	const trailers = [...(unit === undefined ? [] : [`lightsout plan ${unit}`]), ...(runId === undefined ? [] : [`lightsout run ${runId}`])];
	const paragraphs = [subject, ...(prose === '' ? [] : [prose]), ...(trailers.length === 0 ? [] : [trailers.join('\n')])];

	return `${paragraphs.join('\n\n')}\n`;
};
