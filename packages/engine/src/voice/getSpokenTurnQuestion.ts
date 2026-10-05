import { formatSpeakable } from '#src/voice/common/formatSpeakable.ts';
import { getStringField } from '#src/voice/common/getStringField.ts';
import { isQuestionText } from '#src/voice/common/isQuestionText.ts';

interface Params {
	/** The finished turn's message content blocks, as the harness reports them — shape untrusted. */
	blocks: unknown;
}

/**
 * The pi-family counterpart of `getSpokenQuestion`: an omp or pi extension
 * hands over the final turn's content directly, so there is no transcript to
 * walk.
 *
 * Never throws: an error would surface in the user's own session.
 */
export const getSpokenTurnQuestion = ({ blocks }: Params): string | undefined => {
	if (!Array.isArray(blocks)) {
		return undefined;
	}

	const texts = blocks
		.map((block) => (getStringField({ value: block, key: 'type' }) === 'text' ? getStringField({ value: block, key: 'text' }) : undefined))
		.filter((text): text is string => text !== undefined && isQuestionText({ text }))
		.map((text) => formatSpeakable({ text }));

	return texts.length === 0 ? undefined : texts.join('\n\n');
};
