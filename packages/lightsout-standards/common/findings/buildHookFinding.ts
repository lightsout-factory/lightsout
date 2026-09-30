import type { RawStandardsFinding } from '@lightsout/standards-contracts';
import type { CallBlock } from '../types/CallBlock.ts';
import { buildLineSites } from './buildLineSites.ts';
import { buildRawFinding } from './buildRawFinding.ts';

interface Params {
	/** The rule asking — it names the finding's site key. */
	rule: string;
	/** Repo-relative test file path — the finding's site. */
	file: string;
	/** The hook blocks to judge — pass the `beforeEach` blocks alone for a rule whose prose names only that hook. */
	blocks: CallBlock[];
	/** What marks a hook body as violating. Must not be a global regex — `test` on one would skip every other block. */
	pattern: RegExp;
	/** Completes the sentence after `beforeEach at line 6`, e.g. `asserts`. */
	detailSuffix: string;
	guidance: string;
}

export const buildHookFinding = ({ rule, file, blocks, pattern, detailSuffix, guidance }: Params): RawStandardsFinding[] => {
	const hooks = blocks.filter((block) => pattern.test(block.body));

	return hooks.length === 0
		? []
		: [
				buildRawFinding({
					rule,
					files: buildLineSites({ file, spans: hooks }),
					detail: `${hooks.map((block) => `${block.callee} at line ${block.startLine}`).join(', ')} ${detailSuffix}`,
					guidance,
				}),
			];
};
