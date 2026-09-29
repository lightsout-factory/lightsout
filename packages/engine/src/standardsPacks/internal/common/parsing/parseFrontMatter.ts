import { parse } from 'yaml';
import { messageOf } from '#src/common/utils/messageOf.ts';

interface Params {
	text: string;
}

const frontMatterBlock = /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/;

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);

/**
 * A file with no front matter is not an error: every field callers read has a default.
 *
 * @throws {Error} When a front matter block is present but is not valid YAML.
 */
export const parseFrontMatter = ({ text }: Params): { data: Record<string, unknown>; body: string } => {
	const match = frontMatterBlock.exec(text);
	let data: Record<string, unknown> = {};
	let body = text;

	if (match?.[1] !== undefined) {
		const block = match[1];
		let parsed: unknown;

		try {
			parsed = parse(block);
		} catch (error) {
			const firstLine = block.split('\n')[0] ?? '';

			throw new Error(`front matter is not valid YAML (starting "${firstLine}"): ${messageOf({ error })}`);
		}

		data = isRecord(parsed) ? parsed : {};
		body = text.slice(match[0].length);
	}

	return { data, body };
};
