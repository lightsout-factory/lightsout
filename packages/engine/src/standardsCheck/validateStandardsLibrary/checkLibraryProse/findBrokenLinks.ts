import { existsSync } from 'node:fs';
import { join } from 'node:path';

interface Params {
	/** Markdown prose, as a rule.md or topic.md body holds it. */
	text: string;
	/** Absolute folder the prose's file sits in — what a relative link resolves against. */
	fromFolder: string;
}

const inlineLink = /\[[^\]]*\]\(\s*<?([^)\s>]+)>?(?:\s+"[^"]*")?\s*\)/g;

/** A link carrying a scheme (`https:`, `mailto:`) or pointing inside the page names nothing on disk. */
const isOnDisk = ({ target }: { target: string }) => !/^[a-z][a-z0-9+.-]*:/i.test(target) && !target.startsWith('#');

/** Fenced code shows links as text an example happens to contain, never as links the reader follows. */
const outsideFences = ({ text }: { text: string }) => {
	let fence: string | undefined;

	return text
		.split('\n')
		.filter((line) => {
			const marker = /^ {0,3}(`{3,}|~{3,})/.exec(line)?.[1];

			if (marker === undefined) {
				return fence === undefined;
			}

			if (fence === undefined) {
				fence = marker;
			} else if (marker[0] === fence[0] && marker.length >= fence.length) {
				fence = undefined;
			}

			return false;
		})
		.join('\n');
};

/**
 * The relative link targets in `text` whose file does not exist. Only the file
 * is checked: an anchor names a heading, which a rewrite is free to change.
 */
export const findBrokenLinks = ({ text, fromFolder }: Params): string[] =>
	[...outsideFences({ text }).matchAll(inlineLink)]
		.map((match) => match[1])
		.filter((target) => isOnDisk({ target }))
		.filter((target) => !existsSync(join(fromFolder, decodeURI(target.split(/[#?]/)[0]))));
