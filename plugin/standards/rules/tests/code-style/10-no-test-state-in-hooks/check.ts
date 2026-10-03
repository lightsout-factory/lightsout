import type { RawStandardsFinding, StandardsCheckModule } from '@lightsout/standards-contracts';
import { readTestFiles } from '#common/checkInput/readTestFiles.ts';
import { buildLineSites } from '#common/findings/buildLineSites.ts';
import { buildRawFinding } from '#common/findings/buildRawFinding.ts';
import { readCallBlocks } from '#common/parsing/readCallBlocks.ts';
import { scanTestLines } from '#common/parsing/scanTestLines.ts';
import type { CallBlock } from '#common/types/CallBlock.ts';

/** A `let` declaration, however it is indented — the enclosing blocks decide whether it is shared state. */
const letDeclaration = /^\s*let\s+([A-Za-z0-9_$]+)/;

/**
 * What a `beforeEach` body must not hold, and how a finding words each. The
 * `*Once` setters are deliberately absent — the prose does not name them.
 */
const hookBans = [
	{ pattern: /\bexpect\s*\(/, says: 'asserts' },
	{ pattern: /\.mock(?:ReturnValue|ResolvedValue|RejectedValue|Implementation)\s*\(/, says: 'sets a mock return value' },
];

// A `let` inside a hook or a test body is that block's own local; only one
// declared at module or describe scope can be the shared state the rule bans,
// and only when a `beforeEach` reassigns it.
const findSharedLets = ({ text, blocks, beforeEachBlocks }: { text: string; blocks: CallBlock[]; beforeEachBlocks: CallBlock[] }) =>
	scanTestLines({ text, pattern: letDeclaration }).filter(
		({ name, line }) =>
			!blocks.some((block) => block.startLine <= line && line <= block.endLine) &&
			beforeEachBlocks.some((block) => new RegExp(`\\b${name}\\s*=(?![=>])`).test(block.body)),
	);

// `beforeEach` only, the single hook the rule names — an `expect` in an
// `afterEach` is an ordinary leak check the prose never bans. One file's breaks
// share one finding, because a finding's identity is its path.
const stateInHookFindings = ({ file, text }: { file: string; text: string }) => {
	const blocks = readCallBlocks({ text, callees: ['beforeEach', 'beforeAll', 'afterEach', 'afterAll', 'test', 'it'] });
	const beforeEachBlocks = blocks.filter((block) => block.callee === 'beforeEach');
	const sharedLets = findSharedLets({ text, blocks, beforeEachBlocks });
	const banned = hookBans
		.map(({ pattern, says }) => ({ says, hooks: beforeEachBlocks.filter((block) => pattern.test(block.body)) }))
		.filter(({ hooks }) => hooks.length > 0);
	const details = [
		...(sharedLets.length === 0 ? [] : [`${sharedLets.map(({ name, line }) => `'${name}' (line ${line})`).join(', ')} reassigned in a beforeEach`]),
		...banned.map(({ says, hooks }) => `${hooks.map((block) => `beforeEach at line ${block.startLine}`).join(', ')} ${says}`),
	];
	const spans = [
		...sharedLets.map(({ line }) => ({ startLine: line, endLine: line })),
		...beforeEachBlocks.filter((block) => banned.some(({ hooks }) => hooks.includes(block))),
	];

	return details.length === 0
		? []
		: [
				buildRawFinding({
					rule: 'no-test-state-in-hooks',
					files: buildLineSites({ file, spans }),
					detail: details.join('; '),
					guidance: 'Build test state in the `setup()` factory and return it as consts; act and assert in the `test`.',
				}),
			];
};

export const check: StandardsCheckModule = {
	inputKinds: ['test-file'],
	run: ({ inputs }): RawStandardsFinding[] => readTestFiles({ input: inputs['test-file'] }).flatMap(stateInHookFindings),
};
