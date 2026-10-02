import { expect, jest, test } from '@jest/globals';
import { printRunHeader } from '#src/cli/internal/common/render/printRunHeader.ts';
import type { LightsoutConfig } from '#src/contracts/LightsoutConfig.ts';
import type { Driver } from '#src/drivers/common/types/Driver.ts';
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
		'  repo root: lightsout/node (detected)',
		'  harness: claude-code · model: harness default · effort: harness default · permissions: write',
		'  timeouts: agent 60m · supervisor 15m · gate 15m',
		'  gates (root): check=[pnpm check] test=[pnpm test:unit] coverage=[pnpm test:coverage]',
	]);
});

test('the header names the built-in library lightsout when no standards are configured', async () => {
	const { config, driver, cwd, logged } = setupHeader();

	await printRunHeader({ config, driver, cwd, configPath });

	// a repo with no package.json declares nothing, so the built-in library's node pack is detected
	expect(lineFor({ logged, label: 'repo root' })).toBe('  repo root: lightsout/node (detected)');
});

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
		'  repo root: lightsout/node (detected)',
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

test('printRunHeader: standards turned off explicitly are announced as such', async () => {
	const { config, driver, cwd, logged } = setupHeader({ config: { 'standards-pack': false } });

	await printRunHeader({ config, driver, cwd, configPath });

	expect(lineFor({ logged, label: 'repo root' })).toBe('  repo root: none (standards-pack false)');
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

/** A repo on disk whose root manifest has no framework dependency, so the standards line resolves real packs. */
const setupStandardsHeader = async ({ config = {} }: { config?: Partial<LightsoutConfig> } = {}) => {
	const cwd = await freshCwd();

	writeRepoFile({ cwd, path: 'package.json', content: JSON.stringify({ name: 'plain-repo', dependencies: { zod: '^4.0.0' } }) });

	const { config: fullConfig, driver, logged } = setupHeader({ config });

	return { config: fullConfig, driver, cwd, logged };
};

test('printRunHeader: an unset standards-pack prints the detected pack and says it was detected', async () => {
	const { config, driver, cwd, logged } = await setupStandardsHeader();

	await printRunHeader({ config, driver, cwd, configPath });

	expect(lineFor({ logged, label: 'repo root' })).toMatch(/lightsout\/node.*detected/);
});

test.each([
	{ standardsPack: 'lightsout/react-app' as const, expected: /lightsout\/react-app.*named/ },
	{ standardsPack: false as const, expected: /standards-pack.*false/ },
])('printRunHeader: a named pack is marked named and standards-pack false is announced as none', async ({ standardsPack, expected }) => {
	const { config, driver, cwd, logged } = await setupStandardsHeader({ config: { 'standards-pack': standardsPack } });

	await printRunHeader({ config, driver, cwd, configPath });

	expect(lineFor({ logged, label: 'repo root' })).toMatch(expected);
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
		config: { 'package-standards-packs': { 'web-app': 'lightsout/react-app', tools: 'lightsout/node' } },
		packages: ['engine', 'tools', 'web-app'],
		expected: [
			{ text: 'repo root: lightsout/node (detected)', nested: false },
			{ text: 'tools: lightsout/node (named)', nested: true },
			{ text: 'web-app: lightsout/react-app (named)', nested: true },
		],
	},
	{
		config: {},
		packages: ['engine'],
		expected: [{ text: 'repo root: lightsout/node (detected)', nested: false }],
	},
	{
		config: { 'standards-pack': false, 'package-standards-packs': { 'web-app': 'lightsout/react-app' } },
		packages: ['engine', 'web-app'],
		expected: [
			{ text: 'repo root: none (standards-pack false)', nested: false },
			{ text: 'web-app: lightsout/react-app (named)', nested: true },
		],
	},
];

test.each(packageStandardsCases)(
	"prints the repo root pack and one indented line per package whose pack address or source differs from the root's",
	async ({ config: standardsConfig, packages, expected }) => {
		const { config, driver, cwd, logged } = await setupPackageStandardsHeader({ config: standardsConfig, packages });

		await printRunHeader({ config, driver, cwd, configPath });

		expect(standardsLinesOf({ logged })).toStrictEqual(expected);
	},
);
