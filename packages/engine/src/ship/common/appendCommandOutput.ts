import { maskSecrets } from '#src/ship/common/maskSecrets.ts';

interface Params {
	sentence: string;
	stderr: string;
}

/**
 * Redacted because the result file is quoted outward by tracker skills and `git push` stderr can
 * echo a tokenized remote. Capped because a tracker skill quotes it into a comment; it is not a log.
 */
export const appendCommandOutput = ({ sentence, stderr }: Params): string => {
	const maxStderrCharacters = 500;
	const trimmed = maskSecrets({ text: stderr }).trim();
	const capped = trimmed.length > maxStderrCharacters ? `${trimmed.slice(0, maxStderrCharacters)}…` : trimmed;

	return capped === '' ? sentence : `${sentence}: ${capped}`;
};
