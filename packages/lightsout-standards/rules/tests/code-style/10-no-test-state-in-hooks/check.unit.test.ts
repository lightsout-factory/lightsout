import { describe, expect, test } from '@jest/globals';
import { setupOtherKindInput, setupTestFileInput } from '@lightsout/standards-testkit';
import { check } from './check.ts';

const path = 'src/feature/getLabel.unit.test.ts';
const guidance = 'Build test state in the `setup()` factory and return it as consts; act and assert in the `test`.';

/** A module-scope `let` on line 1 that a `beforeEach` reassigns. */
const sharedLetSource = ['let subject: string;', '', "describe('subject', () => {", '\tbeforeEach(() => {', "\t\tsubject = 'ready';", '\t});', '});'].join(
	'\n',
);

/** Two module-scope `let`s, on lines 1 and 2, both reassigned by the same hook. */
const twoSharedLetsSource = [
	'let subject: string;',
	'let helper: string;',
	'',
	"describe('subject', () => {",
	'\tbeforeEach(() => {',
	"\t\tsubject = 'ready';",
	"\t\thelper = 'ready';",
	'\t});',
	'});',
].join('\n');

/** A `let` declared inside the hook itself — that block's own local, not state shared between tests. */
const hookLocalLetSource = ["describe('subject', () => {", '\tbeforeEach(() => {', "\t\tlet subject = 'ready';", "\t\tsubject = 'set';", '\t});', '});'].join(
	'\n',
);

/** A module-scope `let` that only a test writes to — no hook leaves anything behind for the next test. */
const testAssignedLetSource = [
	"let subject = 'ready';",
	'',
	"describe('subject', () => {",
	"\ttest('sets the subject', () => {",
	"\t\tsubject = 'set';",
	'\t});',
	'});',
].join('\n');

/** A module-scope `let` a hook only passes on — reading is not reassigning, and the hook neither asserts nor sets a return value. */
const readLetSource = ["let subject = 'ready';", '', "describe('subject', () => {", '\tbeforeEach(() => {', '\t\tregister(subject);', '\t});', '});'].join(
	'\n',
);

/** A suite whose named hook holds the one named statement — the hook opens on line 2 and closes on line 4. */
const buildHookSource = ({ hook, statement }: { hook: string; statement: string }) =>
	["describe('subject', () => {", `\t${hook}(() => {`, `\t\t${statement}`, '\t});', '});'].join('\n');

const assertion = 'expect(1 + 1).toBe(2);';

/** Two asserting `beforeEach` hooks in one suite, opening on lines 2 and 6. */
const twoAssertingHooksSource = [
	"describe('subject', () => {",
	'\tbeforeEach(() => {',
	'\t\texpect(1 + 1).toBe(2);',
	'\t});',
	'',
	'\tbeforeEach(() => {',
	'\t\texpect(2 + 2).toBe(4);',
	'\t});',
	'});',
].join('\n');

/** Every break at once: a shared `let` on line 1, and one `beforeEach`, lines 4 to 8, that reassigns it, sets a return value and asserts. */
const everyBreakSource = [
	'let subject: string;',
	'',
	"describe('subject', () => {",
	'\tbeforeEach(() => {',
	"\t\tmockGetProfile.mockReturnValue('p.png');",
	'\t\tsubject = mockGetProfile();',
	"\t\texpect(subject).toBe('p.png');",
	'\t});',
	'});',
].join('\n');

describe('no-test-state-in-hooks check', () => {
	test('asks for test files, the one input kind that carries test text alone', () => {
		expect(check.inputKind).toBe('test-file');
	});

	test('reports a module-scope let that a beforeEach reassigns', async () => {
		const input = setupTestFileInput({ contents: [[path, sharedLetSource]] });

		const findings = await check.run({ input, options: {} });

		expect(findings).toStrictEqual([
			{
				siteKey: `no-test-state-in-hooks:${path}`,
				files: [{ path, startLine: 1, endLine: 1 }],
				detail: "'subject' (line 1) reassigned in a beforeEach",
				guidance,
			},
		]);
	});

	test('names every shared let of one file in a single finding, each with its own line', async () => {
		const input = setupTestFileInput({ contents: [[path, twoSharedLetsSource]] });

		const findings = await check.run({ input, options: {} });

		expect(findings).toStrictEqual([
			{
				siteKey: `no-test-state-in-hooks:${path}`,
				files: [
					{ path, startLine: 1, endLine: 1 },
					{ path, startLine: 2, endLine: 2 },
				],
				detail: "'subject' (line 1), 'helper' (line 2) reassigned in a beforeEach",
				guidance,
			},
		]);
	});

	test.each([{ source: hookLocalLetSource }, { source: testAssignedLetSource }, { source: readLetSource }])(
		'leaves a let alone when it is the hook’s own local, only a test writes to it, or the hook only reads it',
		async ({ source }) => {
			const input = setupTestFileInput({ contents: [[path, source]] });

			const findings = await check.run({ input, options: {} });

			expect(findings).toStrictEqual([]);
		},
	);

	test('reports a beforeEach that asserts, naming the line it opens on', async () => {
		const input = setupTestFileInput({ contents: [[path, buildHookSource({ hook: 'beforeEach', statement: assertion })]] });

		const findings = await check.run({ input, options: {} });

		expect(findings).toStrictEqual([
			{
				siteKey: `no-test-state-in-hooks:${path}`,
				files: [{ path, startLine: 2, endLine: 4 }],
				detail: 'beforeEach at line 2 asserts',
				guidance,
			},
		]);
	});

	test('names every asserting beforeEach of one file in a single finding', async () => {
		const input = setupTestFileInput({ contents: [[path, twoAssertingHooksSource]] });

		const findings = await check.run({ input, options: {} });

		expect(findings).toStrictEqual([
			{
				siteKey: `no-test-state-in-hooks:${path}`,
				files: [
					{ path, startLine: 2, endLine: 4 },
					{ path, startLine: 6, endLine: 8 },
				],
				detail: 'beforeEach at line 2, beforeEach at line 6 asserts',
				guidance,
			},
		]);
	});

	test.each([{ setter: 'mockReturnValue' }, { setter: 'mockResolvedValue' }, { setter: 'mockRejectedValue' }, { setter: 'mockImplementation' }])(
		'reports a beforeEach calling $setter',
		async ({ setter }) => {
			const input = setupTestFileInput({ contents: [[path, buildHookSource({ hook: 'beforeEach', statement: `mockGetProfile.${setter}('p.png');` })]] });

			const findings = await check.run({ input, options: {} });

			expect(findings).toStrictEqual([
				{
					siteKey: `no-test-state-in-hooks:${path}`,
					files: [{ path, startLine: 2, endLine: 4 }],
					detail: 'beforeEach at line 2 sets a mock return value',
					guidance,
				},
			]);
		},
	);

	test('leaves a one-call override alone — the rule names the four setters and not their Once variants', async () => {
		const source = buildHookSource({ hook: 'beforeEach', statement: "mockGetProfile.mockReturnValueOnce('p.png');" });
		const input = setupTestFileInput({ contents: [[path, source]] });

		const findings = await check.run({ input, options: {} });

		expect(findings).toStrictEqual([]);
	});

	test.each([
		{ hook: 'afterEach', statement: assertion },
		{ hook: 'beforeAll', statement: assertion },
		{ hook: 'afterAll', statement: assertion },
		{ hook: 'afterEach', statement: "mockGetProfile.mockReturnValue('p.png');" },
		{ hook: 'beforeAll', statement: "mockGetProfile.mockReturnValue('p.png');" },
		{ hook: 'afterAll', statement: "mockGetProfile.mockReturnValue('p.png');" },
	])('leaves `$statement` in a $hook alone — the rule names beforeEach and nothing else', async ({ hook, statement }) => {
		const input = setupTestFileInput({ contents: [[path, buildHookSource({ hook, statement })]] });

		const findings = await check.run({ input, options: {} });

		expect(findings).toStrictEqual([]);
	});

	test('gathers every break of one file into a single finding, listing a hook that breaks the rule twice once', async () => {
		const input = setupTestFileInput({ contents: [[path, everyBreakSource]] });

		const findings = await check.run({ input, options: {} });

		// one finding per file, since a finding's identity is its path
		expect(findings).toStrictEqual([
			{
				siteKey: `no-test-state-in-hooks:${path}`,
				files: [
					{ path, startLine: 1, endLine: 1 },
					{ path, startLine: 4, endLine: 8 },
				],
				detail: "'subject' (line 1) reassigned in a beforeEach; beforeEach at line 4 asserts; beforeEach at line 4 sets a mock return value",
				guidance,
			},
		]);
	});

	test('reports each file on its own', async () => {
		const input = setupTestFileInput({
			contents: [
				['src/a/getA.unit.test.ts', sharedLetSource],
				['src/b/getB.unit.test.ts', buildHookSource({ hook: 'beforeEach', statement: assertion })],
			],
		});

		const findings = await check.run({ input, options: {} });

		expect(findings.map(({ siteKey }) => siteKey)).toStrictEqual([
			'no-test-state-in-hooks:src/a/getA.unit.test.ts',
			'no-test-state-in-hooks:src/b/getB.unit.test.ts',
		]);
	});

	test('reports nothing for an input of any other kind rather than refusing', async () => {
		const findings = await check.run({ input: setupOtherKindInput(), options: {} });

		expect(findings).toStrictEqual([]);
	});
});
