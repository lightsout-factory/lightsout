import { describe, expect, test } from '@jest/globals';
import type { LoadedStandardsLibrary } from '#src/common/types/LoadedStandardsLibrary.ts';
import type { ResolvedStandardsPack } from '#src/common/types/ResolvedStandardsPack.ts';
import { messageOf } from '#src/common/utils/messageOf.ts';
import { StandardsSeverity } from '#src/contracts/standardsCheck/StandardsSeverity.ts';
import { resolveStandardsPack } from '#src/standardsLibraries/resolveStandardsPack/resolveStandardsPack.ts';
import { setupStandardsLibraries } from '#tests/helpers/setupStandardsLibraries.ts';

/** What a resolved pack brings in: topic addresses and each rule's full name with its grade, in the pack's own order. */
const summarizePack = ({ pack }: { pack: ResolvedStandardsPack }) => ({
	name: pack.name,
	topics: pack.topics.map((topic) => `${topic.library}/${topic.path}`),
	rules: pack.rules.map(({ rule, severity, options }) => ({ name: rule.name, severity, options })),
});

const resolveSummary = ({ address, libraries }: { address: string; libraries: LoadedStandardsLibrary[] }) =>
	summarizePack({ pack: resolveStandardsPack({ addresses: [address], libraries, dependencies: undefined }) });

/** The summary of the resolved pack, or the message it threw — so one act can cover a pack that resolves and one that does not. */
const attemptSummary = ({ address, libraries }: { address: string; libraries: LoadedStandardsLibrary[] }) => {
	let outcome: { value: ReturnType<typeof summarizePack> } | { message: string };

	try {
		outcome = { value: resolveSummary({ address, libraries }) };
	} catch (error) {
		outcome = { message: messageOf({ error }) };
	}

	return outcome;
};

/** Matches a message holding every part, in any order. */
const containsAll = (...parts: string[]) => {
	const lookaheads = parts.map((part) => {
		const literal = part.replace(/[.*+?^$()|[\]\\{}]/g, '\\$&');

		return `(?=[\\s\\S]*${literal})`;
	});

	return new RegExp(lookaheads.join(''));
};

describe('resolveStandardsPack', () => {
	test('resolveStandardsPack lets the last listed included pack win and merges options key by key', () => {
		const { libraries } = setupStandardsLibraries({
			libraries: [
				{
					name: 'acme',
					topics: [{ path: 'code/demo', rules: [{ id: 'size', severity: StandardsSeverity.Off, options: { limit: 100, depth: 3, width: 5 } }] }],
					packs: [
						{ name: 'a', rules: ['size'], ruleSettings: { size: { severity: 'advisory', options: { depth: 4, limit: 50 } } } },
						{ name: 'b', rules: ['size'], ruleSettings: { size: { severity: 'blocking', options: { width: 8, limit: 70 } } } },
						{ name: 'a-then-b', packs: ['acme/a', 'acme/b'] },
						{ name: 'b-then-a', packs: ['acme/b', 'acme/a'] },
					],
				},
			],
		});

		const summaries = ['acme/a-then-b', 'acme/b-then-a'].map((address) => resolveSummary({ address, libraries }));

		expect(summaries).toStrictEqual([
			{
				name: 'acme/a-then-b',
				topics: ['acme/code/demo'],
				rules: [{ name: 'acme/size', severity: 'blocking', options: { limit: 70, depth: 4, width: 8 } }],
			},
			{
				name: 'acme/b-then-a',
				topics: ['acme/code/demo'],
				rules: [{ name: 'acme/size', severity: 'advisory', options: { limit: 50, depth: 4, width: 8 } }],
			},
		]);
	});

	test('resolveStandardsPack counts only explicit values when included packs disagree', () => {
		const { libraries } = setupStandardsLibraries({
			libraries: [
				{
					name: 'acme',
					topics: [{ path: 'code/demo', rules: [{ id: 'size', severity: StandardsSeverity.Blocking, options: { limit: 10 } }] }],
					packs: [
						{ name: 'a', rules: ['size'], ruleSettings: { size: 'advisory' } },
						{ name: 'b', topics: ['acme/code/demo'] },
						{ name: 'top', packs: ['acme/a', 'acme/b'] },
					],
				},
			],
		});

		const summary = resolveSummary({ address: 'acme/top', libraries });

		expect(summary).toStrictEqual({
			name: 'acme/top',
			topics: ['acme/code/demo'],
			rules: [{ name: 'acme/size', severity: 'advisory', options: { limit: 10 } }],
		});
	});

	test("resolveStandardsPack applies the pack's own rule-settings last and keeps an off rule listed", () => {
		const { libraries } = setupStandardsLibraries({
			libraries: [
				{
					name: 'acme',
					topics: [
						{
							path: 'code/demo',
							rules: [
								{ id: 'size', severity: StandardsSeverity.Blocking },
								{ id: 'depth', severity: StandardsSeverity.Advisory, options: { limit: 10, width: 1, height: 3 } },
							],
						},
					],
					packs: [
						{ name: 'base', topics: ['acme/code/demo'], ruleSettings: { depth: { options: { limit: 5 } } } },
						{ name: 'top', packs: ['acme/base'], ruleSettings: { size: 'off', depth: { options: { width: 2 } } } },
					],
				},
			],
		});

		const summary = resolveSummary({ address: 'acme/top', libraries });

		expect(summary.rules).toStrictEqual([
			{ name: 'acme/size', severity: 'off', options: {} },
			{ name: 'acme/depth', severity: 'advisory', options: { limit: 5, width: 2, height: 3 } },
		]);
	});

	test('resolveStandardsPack refuses rule-settings for a rule the pack does not include', () => {
		const { libraries } = setupStandardsLibraries({
			libraries: [
				{
					name: 'acme',
					topics: [
						{ path: 'code/demo', rules: [{ id: 'size' }] },
						{ path: 'code/other', rules: [{ id: 'naming' }] },
					],
					packs: [{ name: 'lean', rules: ['size'], ruleSettings: { naming: 'blocking' } }],
				},
			],
		});

		expect(() => resolveStandardsPack({ addresses: ['acme/lean'], libraries, dependencies: undefined })).toThrow(containsAll('acme/lean', 'naming'));
	});

	test('resolveStandardsPack brings in a whole topic with its rules at their defaults', () => {
		const { libraries } = setupStandardsLibraries({
			libraries: [
				{
					name: 'acme',
					topics: [
						{
							path: 'code/demo',
							rules: [
								{ id: 'size', severity: StandardsSeverity.Advisory, options: { limit: 10 } },
								{ id: 'depth', severity: StandardsSeverity.Off },
							],
						},
						{ path: 'code/empty' },
						{ path: 'code/other', rules: [{ id: 'naming' }] },
					],
					packs: [{ name: 'lean', topics: ['acme/code/demo', 'acme/code/empty'] }],
				},
			],
		});

		const summary = resolveSummary({ address: 'acme/lean', libraries });

		expect(summary).toStrictEqual({
			name: 'acme/lean',
			topics: ['acme/code/demo', 'acme/code/empty'],
			rules: [
				{ name: 'acme/size', severity: 'advisory', options: { limit: 10 } },
				{ name: 'acme/depth', severity: 'off', options: {} },
			],
		});
	});

	test('resolveStandardsPack brings a single rule with its topic and without its siblings', () => {
		const { libraries } = setupStandardsLibraries({
			libraries: [
				{
					name: 'acme',
					topics: [{ path: 'code/demo', rules: [{ id: 'size' }, { id: 'depth' }] }],
					packs: [{ name: 'lean', rules: ['size'] }],
				},
			],
		});

		const summary = resolveSummary({ address: 'acme/lean', libraries });

		expect(summary).toStrictEqual({
			name: 'acme/lean',
			topics: ['acme/code/demo'],
			rules: [{ name: 'acme/size', severity: 'blocking', options: {} }],
		});
	});

	test('resolveStandardsPack resolves short names only among the libraries the pack can see', () => {
		const { libraries } = setupStandardsLibraries({
			libraries: [
				{
					name: 'acme',
					topics: [{ path: 'code/demo', rules: [{ id: 'size' }] }],
					packs: [
						{ name: 'lean', rules: ['size'] },
						{ name: 'both', packs: ['house/empty'], rules: ['size'] },
					],
				},
				{
					name: 'house',
					topics: [{ path: 'code/demo', rules: [{ id: 'size' }] }],
					packs: [{ name: 'empty' }],
				},
			],
		});

		const outcomes = ['acme/lean', 'acme/both'].map((address) => attemptSummary({ address, libraries }));

		expect(outcomes).toEqual([
			{
				value: {
					name: 'acme/lean',
					topics: ['acme/code/demo'],
					rules: [{ name: 'acme/size', severity: 'blocking', options: {} }],
				},
			},
			{ message: expect.stringMatching(containsAll('acme/size', 'house/size')) },
		]);
	});

	test('resolveStandardsPack brings topics and rules from another library it names, and grades them by full or short name', () => {
		const { libraries } = setupStandardsLibraries({
			libraries: [
				{
					name: 'acme',
					topics: [{ path: 'code/demo', rules: [{ id: 'size' }] }],
					packs: [
						{ name: 'mixed', topics: ['house/code/style'], rules: ['house/depth'], ruleSettings: { width: 'off', 'house/depth': { severity: 'advisory' } } },
					],
				},
				{
					name: 'house',
					topics: [
						{ path: 'code/style', rules: [{ id: 'width', options: { max: 3 } }] },
						{ path: 'code/other', rules: [{ id: 'depth', options: { limit: 2 } }, { id: 'sibling' }] },
					],
				},
			],
		});

		const summary = resolveSummary({ address: 'acme/mixed', libraries });

		expect(summary).toStrictEqual({
			name: 'acme/mixed',
			topics: ['house/code/style', 'house/code/other'],
			rules: [
				{ name: 'house/width', severity: 'off', options: { max: 3 } },
				{ name: 'house/depth', severity: 'advisory', options: { limit: 2 } },
			],
		});
	});

	test('resolveStandardsPack refuses include entries that name nothing', () => {
		const { libraries } = setupStandardsLibraries({
			libraries: [
				{
					name: 'acme',
					topics: [{ path: 'code/demo', rules: [{ id: 'size' }] }],
					packs: [
						{ name: 'bad-packs', packs: ['acme/missing-pack'] },
						{ name: 'bad-topics', topics: ['acme/code/missing-topic'] },
						{ name: 'bad-rules', rules: ['missing-rule'] },
					],
				},
			],
		});

		const outcomes = ['acme/bad-packs', 'acme/bad-topics', 'acme/bad-rules'].map((address) => attemptSummary({ address, libraries }));

		expect(outcomes).toEqual([
			{ message: expect.stringMatching(containsAll('acme/bad-packs', 'acme/missing-pack')) },
			{ message: expect.stringMatching(containsAll('acme/bad-topics', 'acme/code/missing-topic')) },
			{ message: expect.stringMatching(containsAll('acme/bad-rules', 'missing-rule')) },
		]);
	});

	test('resolveStandardsPack names the pack and the entry for an address, a library or a setting it cannot resolve', () => {
		const { libraries } = setupStandardsLibraries({
			libraries: [
				{
					name: 'acme',
					packs: [
						{ name: 'bare-topic', topics: ['demo'] },
						{ name: 'foreign-rule', rules: ['ghost/size'] },
						{ name: 'unknown-setting', ruleSettings: { 'missing-rule': 'off' } },
					],
				},
			],
		});
		// each address resolved, beside the entry its message must name
		const entries = { 'acme/bare-topic': '"demo"', 'acme/foreign-rule': 'ghost', 'acme/unknown-setting': 'missing-rule', 'ghost/base': 'ghost', acme: 'acme' };

		const outcomes = Object.keys(entries).map((address) => attemptSummary({ address, libraries }));

		expect(outcomes).toEqual(Object.entries(entries).map(([address, entry]) => ({ message: expect.stringMatching(containsAll(`pack ${address}`, entry)) })));
	});

	test('resolveStandardsPack refuses a library the repo has not registered', () => {
		const { libraries } = setupStandardsLibraries({
			libraries: [{ name: 'acme', packs: [{ name: 'lean', packs: ['ghost/base'] }] }],
		});

		expect(() => resolveStandardsPack({ addresses: ['acme/lean'], libraries, dependencies: undefined })).toThrow(containsAll('ghost', 'acme/lean'));
	});

	test('resolveStandardsPack refuses an include cycle and accepts a diamond', () => {
		const { libraries } = setupStandardsLibraries({
			libraries: [
				{
					name: 'acme',
					topics: [{ path: 'code/demo', rules: [{ id: 'size' }, { id: 'depth' }] }],
					packs: [
						{ name: 'a', packs: ['acme/b'] },
						{ name: 'b', packs: ['acme/a'] },
						{ name: 'top', packs: ['acme/left', 'acme/right'] },
						{ name: 'left', packs: ['acme/base'] },
						{ name: 'right', packs: ['acme/base'] },
						{ name: 'base', topics: ['acme/code/demo'] },
					],
				},
			],
		});

		const outcomes = ['acme/a', 'acme/top'].map((address) => attemptSummary({ address, libraries }));

		expect(outcomes).toEqual([
			{ message: expect.stringMatching(/acme\/a[\s\S]*acme\/b[\s\S]*acme\/a/) },
			{
				value: {
					name: 'acme/top',
					topics: ['acme/code/demo'],
					rules: [
						{ name: 'acme/size', severity: 'blocking', options: {} },
						{ name: 'acme/depth', severity: 'blocking', options: {} },
					],
				},
			},
		]);
	});
});
