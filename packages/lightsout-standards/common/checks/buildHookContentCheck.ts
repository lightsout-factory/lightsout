import type { StandardsCheckModule } from '@lightsout/standards-contracts';
import { readTestFiles } from '../checkInput/readTestFiles.ts';
import { buildHookFinding } from '../findings/buildHookFinding.ts';
import { readCallBlocks } from '../parsing/readCallBlocks.ts';

interface Params {
	/** The rule asking — it names the finding's site key. */
	rule: string;
	/** The hooks this rule reads, named because the prose names them — a rule about `beforeEach` must not judge an `afterEach`. */
	hooks: string[];
	/** What marks a hook body as violating. Must not be a global regex — `test` on one would skip every other block. */
	pattern: RegExp;
	/** Completes the sentence after `beforeEach at line 6`, e.g. `asserts`. */
	detailSuffix: string;
	guidance: string;
}

export const buildHookContentCheck = ({ rule, hooks, pattern, detailSuffix, guidance }: Params): StandardsCheckModule => ({
	inputKind: 'test-file',
	run: ({ input }) =>
		readTestFiles({ input }).flatMap(({ file, text }) =>
			buildHookFinding({ rule, file, blocks: readCallBlocks({ text, callees: hooks }), pattern, detailSuffix, guidance }),
		),
});
