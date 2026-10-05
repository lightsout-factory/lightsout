import { expect, jest, test } from '@jest/globals';
import { printRunHeader } from '#src/cli/common/render/printRunHeader.ts';
import type { Driver } from '#src/common/types/Driver.ts';
import type { LightsoutConfig } from '#src/contracts/LightsoutConfig/LightsoutConfig.ts';
import { freshCwd } from '#tests/helpers/freshCwd.ts';
import { writeRepoFile } from '#tests/helpers/writeRepoFile.ts';

// The header's whole output IS its console.log lines, so capturing them is the
// arrangement. `t.mock.method` restores the real console.log when the test
// ends, so nothing leaks into the reporter.
const setupHeader = ({ config = {}, driverName = 'claude-code' }: { config?: Partial<LightsoutConfig>; driverName?: string } = {}) => {
	const logged: string[] = [];

	jest.spyOn(console, 'log').mockImplementation((...args: unknown[]) => {
		logged.push(String(args[0]));
	});

	const driver: Driver = { name: driverName, invoke: async () => ({ text: '', exitCode: 0 }) };
	const fullConfig: LightsoutConfig = { gates: { check: 'pnpm check', test: 'pnpm test:unit', 'test-coverage': 'pnpm test:coverage' }, ...config };

	return { config: fullConfig, driver, cwd: '/repo', logged };
};

/** The config every header below reports loading, beside the `/repo` cwd. */
const configPath = '/repo/lightsout.config.json';

const lineFor = ({ logged, label }: { logged: string[]; label: string }) => logged.find((line) => line.startsWith(`  ${label}:`));

test('printRunHeader: a minimal config renders exactly the always-present lines, with every default spelled out', async () => {
	const { config, driver, cwd, logged } = setupHeader();

	await printRunHeader({ config, driver, cwd, configPath });

	expect(logged).toStrictEqual([
		'  cwd: /repo',
		'  config: /repo/lightsout.config.json',
		'  repo root: none (no standards-pack)',
		'  harness: claude-code · model: harness default · effort: harness default · permissions: write',
		'  timeouts: agent 60m · supervisor 15m · gate 15m',
		'  gates (root): check=[pnpm check] test=[pnpm test:unit] coverage=[pnpm test:coverage]',
	]);
});

test.each<{ standardsPack: string; config: Partial<LightsoutConfig>; expected: string }>([
	{ standardsPack: 'unset', config: {}, expected: '  repo root: none (no standards-pack)' },
	{ standardsPack: 'false', config: { 'standards-pack': false }, expected: '  repo root: none (standards-pack false)' },
])(
	'printRunHeader: standards-pack $standardsPack is announced as the repo root having no standards, and says which the config holds',
	async ({ config: standardsConfig, expected }) => {
		const { config, driver, cwd, logged } = setupHeader({ config: standardsConfig });

		await printRunHeader({ config, driver, cwd, configPath });

		// standards are opt-in, so both mean none — but an unset key may be an oversight, and `false` never is
		expect(lineFor({ logged, label: 'repo root' })).toBe(expected);
	},
);

test('printRunHeader: the config line names the file the run loaded, which need not sit under the cwd the run builds in', async () => {
	const { config, driver, logged } = setupHeader();

	// an isolated run builds in its worktree but reads the config of the checkout it was launched from
	await printRunHeader({ config, driver, cwd: '/worktrees/lo-1', configPath });

	expect(lineFor({ logged, label: 'cwd' })).toBe('  cwd: /worktrees/lo-1');
	expect(lineFor({ logged, label: 'config' })).toBe('  config: /repo/lightsout.config.json');
});

test('printRunHeader: prints no config line when there is no recorded path to name', async () => {
	const { config, driver, cwd, logged } = setupHeader();

	// a resumed run whose manifest predates the recorded path has no path to name, and its checkout may well have a config
	await printRunHeader({ config, driver, cwd, configPath: undefined });

	expect(logged).toStrictEqual([
		'  cwd: /repo',
		'  repo root: none (no standards-pack)',
		'  harness: claude-code · model: harness default · effort: harness default · permissions: write',
		'  timeouts: agent 60m · supervisor 15m · gate 15m',
		'  gates (root): check=[pnpm check] test=[pnpm test:unit] coverage=[pnpm test:coverage]',
	]);
});

test('printRunHeader: the harness line names the resolved harness, model, effort, and permissions', async () => {
	const { config, driver, cwd, logged } = setupHeader({ driverName: 'codex', config: { model: 'gpt-5.2', effort: 'high', permissions: 'full-access' } });

	await printRunHeader({ config, driver, cwd, configPath });

	expect(lineFor({ logged, label: 'harness' })).toBe('  harness: codex · model: gpt-5.2 · effort: high · permissions: full-access');
});

test('printRunHeader: configured timeouts replace the 60m/15m/15m defaults', async () => {
	const { config, driver, cwd, logged } = setupHeader({ config: { timeouts: { 'agent-minutes': 90, 'supervisor-minutes': 5, 'gate-minutes': 20 } } });

	await printRunHeader({ config, driver, cwd, configPath });

	expect(lineFor({ logged, label: 'timeouts' })).toBe('  timeouts: agent 90m · supervisor 5m · gate 20m');
});

test('printRunHeader: a coverage gate disabled explicitly prints off (explicit) in place of a command', async () => {
	const { config, driver, cwd, logged } = setupHeader({ config: { gates: { check: 'pnpm check', test: 'pnpm test:unit', 'test-coverage': false } } });

	await printRunHeader({ config, driver, cwd, configPath });

	expect(lineFor({ logged, label: 'gates (root)' })).toBe('  gates (root): check=[pnpm check] test=[pnpm test:unit] coverage=[off (explicit)]');
});

test('printRunHeader: the opt-in generate, build, and format lines print only when their commands are configured', async () => {
	const { config, driver, cwd, logged } = setupHeader({
		config: {
			gates: { check: 'pnpm check', test: 'pnpm test:unit', 'test-coverage': false, generate: 'pnpm gen', build: 'pnpm build', format: 'pnpm format' },
		},
	});

	await printRunHeader({ config, driver, cwd, configPath });

	expect(lineFor({ logged, label: 'generate (before every gate set)' })).toBe('  generate (before every gate set): [pnpm gen]');
	expect(lineFor({ logged, label: 'gates (root, opt-in)' })).toBe('  gates (root, opt-in): build=[pnpm build]');
	expect(lineFor({ logged, label: 'format' })).toBe('  format: [pnpm format]');
});

test('printRunHeader: granted agent commands print as bracketed prefixes', async () => {
	const { config, driver, cwd, logged } = setupHeader({ config: { 'agent-commands': ['pnpm db:migrate', 'npx prisma'] } });

	await printRunHeader({ config, driver, cwd, configPath });

	expect(lineFor({ logged, label: 'agent commands (granted, prefix match)' })).toBe('  agent commands (granted, prefix match): [pnpm db:migrate] [npx prisma]');
});

test('printRunHeader: an empty grant list prints no agent commands line at all', async () => {
	const { config, driver, cwd, logged } = setupHeader({ config: { 'agent-commands': [] } });

	await printRunHeader({ config, driver, cwd, configPath });

	// an empty grant list is the same as none — the header stays quiet
	expect(logged.some((line) => line.includes('agent commands'))).toBe(false);
});

test('printRunHeader: generated path prefixes print as the never-attributed list', async () => {
	const { config, driver, cwd, logged } = setupHeader({ config: { generated: ['src/generated', 'prisma/client'] } });

	await printRunHeader({ config, driver, cwd, configPath });

	expect(lineFor({ logged, label: 'generated (never attributed)' })).toBe('  generated (never attributed): src/generated, prisma/client');
});

test('printRunHeader: package-scoped gates print with no coverage entry when none is configured', async () => {
	const { config, driver, cwd, logged } = setupHeader({
		config: { 'package-gates': { check: 'pnpm --filter {package} check', test: 'pnpm --filter {package} test' } },
	});

	await printRunHeader({ config, driver, cwd, configPath });

	expect(lineFor({ logged, label: 'gates (per package)' })).toBe(
		'  gates (per package): check=[pnpm --filter {package} check] test=[pnpm --filter {package} test]',
	);
});

test('printRunHeader: a scoped coverage gate is appended to the per-package line', async () => {
	const { config, driver, cwd, logged } = setupHeader({
		config: {
			'package-gates': { check: 'pnpm --filter {package} check', test: 'pnpm --filter {package} test', 'test-coverage': 'pnpm --filter {package} coverage' },
		},
	});

	await printRunHeader({ config, driver, cwd, configPath });

	expect(lineFor({ logged, label: 'gates (per package)' })).toBe(
		'  gates (per package): check=[pnpm --filter {package} check] test=[pnpm --filter {package} test] coverage=[pnpm --filter {package} coverage]',
	);
});

/** A repo on disk whose root manifest declares no framework, so the standards line resolves real packs. */
const setupStandardsHeader = async ({ config = {} }: { config?: Partial<LightsoutConfig> } = {}) => {
	const cwd = await freshCwd();

	writeRepoFile({ cwd, path: 'package.json', content: JSON.stringify({ name: 'plain-repo', dependencies: { zod: '^4.0.0' } }) });

	const { config: fullConfig, driver, logged } = setupHeader({ config });

	return { config: fullConfig, driver, cwd, logged };
};

test.each<{ standardsPack: string | string[]; expected: string }>([
	{ standardsPack: 'lightsout/fractal', expected: '  repo root: lightsout/fractal' },
	{ standardsPack: ['lightsout/standards', 'lightsout/fractal'], expected: '  repo root: lightsout/standards + lightsout/fractal' },
])('printRunHeader: the repo root line names the pack the config names, a list joined in listed order', async ({ standardsPack, expected }) => {
	const { config, driver, cwd, logged } = await setupStandardsHeader({ config: { 'standards-pack': standardsPack } });

	await printRunHeader({ config, driver, cwd, configPath });

	// the root manifest declares react nowhere, and nothing is detected from it either way
	expect(lineFor({ logged, label: 'repo root' })).toBe(expected);
});

test('printRunHeader: a pack that will not load is named in the header without failing it', async () => {
	const { config, driver, cwd, logged } = await setupStandardsHeader({ config: { 'standards-pack': 'lightsout/no-such-pack' } });

	const printing = printRunHeader({ config, driver, cwd, configPath });

	await expect(printing).resolves.toBeUndefined();
	expect(lineFor({ logged, label: 'standards' })).toMatch(/lightsout\/no-such-pack/);
});

/** A monorepo on disk: a plain root manifest, and one plain manifest per workspace package. */
const setupPackageStandardsHeader = async ({ config, packages }: { config: Partial<LightsoutConfig>; packages: string[] }) => {
	const cwd = await freshCwd();

	writeRepoFile({ cwd, path: 'package.json', content: JSON.stringify({ name: 'plain-repo', dependencies: { zod: '^4.0.0' } }) });

	for (const name of packages) {
		writeRepoFile({ cwd, path: `packages/${name}/package.json`, content: JSON.stringify({ name, dependencies: { zod: '^4.0.0' } }) });
	}

	const { config: fullConfig, driver, logged } = setupHeader({ config });

	return { config: fullConfig, driver, cwd, logged };
};

/** The root standards line and the lines after it, up to the harness line, each trimmed and marked when indented deeper than the root line. */
const standardsLinesOf = ({ logged }: { logged: string[] }) => {
	const start = logged.findIndex((line) => line.trimStart().startsWith('repo root:'));
	const end = logged.findIndex((line) => line.trimStart().startsWith('harness:'));
	const rootIndent = (logged[start] ?? '').length - (logged[start] ?? '').trimStart().length;

	return logged.slice(start, end).map((line) => ({ text: line.trim(), nested: line.length - line.trimStart().length > rootIndent }));
};

interface PackageStandardsCase {
	config: Partial<LightsoutConfig>;
	packages: string[];
	expected: { text: string; nested: boolean }[];
}

const packageStandardsCases: PackageStandardsCase[] = [
	{
		// tools names the root's own pack, so it shares the root's group and gets no line
		config: { 'standards-pack': 'lightsout/standards', 'package-standards-packs': { 'web-app': 'lightsout/fractal', tools: 'lightsout/standards' } },
		packages: ['engine', 'tools', 'web-app'],
		expected: [
			{ text: 'repo root: lightsout/standards', nested: false },
			{ text: 'web-app: lightsout/fractal', nested: true },
		],
	},
	{
		config: { 'standards-pack': 'lightsout/standards' },
		packages: ['engine'],
		expected: [{ text: 'repo root: lightsout/standards', nested: false }],
	},
	{
		config: { 'standards-pack': false, 'package-standards-packs': { 'web-app': 'lightsout/fractal' } },
		packages: ['engine', 'web-app'],
		expected: [
			{ text: 'repo root: none (standards-pack false)', nested: false },
			{ text: 'web-app: lightsout/fractal', nested: true },
		],
	},
	{
		config: { 'package-standards-packs': { 'web-app': 'lightsout/fractal', tools: 'lightsout/standards' } },
		packages: ['engine', 'tools', 'web-app'],
		expected: [
			{ text: 'repo root: none (no standards-pack)', nested: false },
			{ text: 'tools: lightsout/standards', nested: true },
			{ text: 'web-app: lightsout/fractal', nested: true },
		],
	},
];

test.each(packageStandardsCases)(
	"prints the repo root pack and one indented line per package in a group other than the root's",
	async ({ config: standardsConfig, packages, expected }) => {
		const { config, driver, cwd, logged } = await setupPackageStandardsHeader({ config: standardsConfig, packages });

		await printRunHeader({ config, driver, cwd, configPath });

		expect(standardsLinesOf({ logged })).toStrictEqual(expected);
	},
);

/** One rule folder's files: its markdown plus the fixture pair every rule ships. */
const ruleFiles = ({ path, summary }: { path: string; summary: string }) => ({
	[`${path}/rule.md`]: `---\nsummary: ${summary}\nchecks: agent\n---\n\n${summary} — the rule's prose.\n`,
	[`${path}/fixtures/pass/src/example.ts`]: 'export const example = 1;\n',
	[`${path}/fixtures/fail/src/example.ts`]: 'export const example = 2;\n',
});

/** A `house` library whose `base` pack applies everywhere and whose `react` pack applies only to a package declaring react. */
const houseLibraryFiles = {
	'standards/house/lightsout-standards.json': '{ "name": "house", "formatVersion": 2 }\n',
	'standards/house/rules/code/base/topic.md': '# Base\n\nHow every package writes code.\n',
	...ruleFiles({ path: 'standards/house/rules/code/base/01-tabs', summary: 'indent with tabs' }),
	'standards/house/rules/code/react/topic.md': '# React\n\nHow components are written.\n',
	...ruleFiles({ path: 'standards/house/rules/code/react/01-hooks-first', summary: 'hooks come before handlers' }),
	'standards/house/packs/base.json': JSON.stringify({ description: 'The base pack.', include: { topics: ['house/code/base'] } }),
	'standards/house/packs/react.json': JSON.stringify({
		description: 'The react pack.',
		include: { topics: ['house/code/react'] },
		'applies-when': { dependencies: ['react'] },
	}),
};

/**
 * A monorepo on disk holding the `house` library, whose config puts the root
 * and both packages, `engine` and `web-app`, on `house/base` plus the
 * conditional `house/react`. Each name in `declaringReact` — '' is the root —
 * gets a manifest that declares react.
 */
const setupConditionalHeader = async ({ declaringReact }: { declaringReact: string[] }) => {
	const cwd = await freshCwd();
	const manifestOf = ({ name }: { name: string }) =>
		JSON.stringify({ name: name || 'repo', dependencies: declaringReact.includes(name) ? { react: '^19.0.0' } : {} });

	for (const [path, content] of Object.entries(houseLibraryFiles)) {
		writeRepoFile({ cwd, path, content });
	}

	writeRepoFile({ cwd, path: 'package.json', content: manifestOf({ name: '' }) });
	writeRepoFile({ cwd, path: 'packages/engine/package.json', content: manifestOf({ name: 'engine' }) });
	writeRepoFile({ cwd, path: 'packages/web-app/package.json', content: manifestOf({ name: 'web-app' }) });

	const { config, driver, logged } = setupHeader({
		config: { 'standards-libraries': { house: './standards/house' }, 'standards-pack': ['house/base', 'house/react'] },
	});

	return { config, driver, cwd, logged };
};

test.each([
	{
		declaringReact: ['web-app'],
		expected: [
			{ text: 'repo root: house/base + house/react', nested: false },
			{ text: 'web-app: house/base + house/react (with house/react)', nested: true },
		],
	},
	{
		declaringReact: ['', 'web-app'],
		expected: [
			{ text: 'repo root: house/base + house/react (with house/react)', nested: false },
			{ text: 'engine: house/base + house/react', nested: true },
		],
	},
])('names the conditional packs that applied after the pack, on the root line and on a package line alike', async ({ declaringReact, expected }) => {
	const { config, driver, cwd, logged } = await setupConditionalHeader({ declaringReact });

	await printRunHeader({ config, driver, cwd, configPath });

	expect(standardsLinesOf({ logged })).toStrictEqual(expected);
});
