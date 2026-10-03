import { readCallBlocks } from '#common/parsing/readCallBlocks.ts';
import type { CallBlock } from '#common/types/CallBlock.ts';
import type { UntypedWrapper } from './UntypedWrapper.ts';

/** A factory forward typed to discard its arguments. */
const discardingWrapper = /\(\s*\.\.\.\s*[A-Za-z0-9_$]+\s*:\s*unknown\s*\[\s*\]/;

/** `<property>: () => mockThing()` — a forward that takes no arguments at all. */
const zeroArgWrapper = /([A-Za-z0-9_$]+)\s*:\s*\(\s*\)\s*=>\s*(mock[A-Za-z0-9_$]*)\s*\(/g;

interface Params {
	/** One test file's text. */
	text: string;
}

const getReasons = ({ block, text }: { block: CallBlock; text: string }) => {
	const reasons: string[] = discardingWrapper.test(block.body) ? ['a `(...args: unknown[])` wrapper'] : [];

	for (const forward of block.body.matchAll(zeroArgWrapper)) {
		if (new RegExp(`expect\\(\\s*${forward[2]}\\s*\\)[^;]*toHaveBeenCalledWith`).test(text)) {
			reasons.push(`'${forward[1]}' forwards no arguments to ${forward[2]}`);
		}
	}

	return reasons;
};

/**
 * The `jest.mock()` factories whose wrappers lose arguments. A discarding
 * wrapper is named outright. A zero-argument forward needs evidence: the
 * file's own `toHaveBeenCalledWith` on that mock proves the function takes
 * arguments, and without it there is nothing to report.
 */
export const findUntypedWrappers = ({ text }: Params): UntypedWrapper[] =>
	readCallBlocks({ text, callees: ['jest.mock'] })
		.map((block) => ({ block, reasons: getReasons({ block, text }) }))
		.filter(({ reasons }) => reasons.length > 0);
