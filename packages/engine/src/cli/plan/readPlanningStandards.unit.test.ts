import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { expect, test } from '@jest/globals';
import { readPlanningStandards } from '#src/cli/plan/readPlanningStandards.ts';
import type { LightsoutConfig } from '#src/contracts/LightsoutConfig.ts';
import { captureCommandOutput } from '#tests/helpers/captureCommandOutput.ts';

/** A one-rule standards library to write inside the repo, in the code tree unless told otherwise, with a `demo` pack that includes its one topic. */
interface StandardsPackage {
	at: string;
	name: string;
	ruleId: string;
	prose: string;
	set?: 'code' | 'tests';
}

const writeStandardsPackage = ({ cwd, at, name, ruleId, prose, set = 'code' }: StandardsPackage & { cwd: string }) => {
	const packagePath = join(cwd, at);
	const rulePath = `rules/${set}/demo/01-${ruleId}`;
	const files: Record<string, string> = {
		'lightsout-standards.json': `{ "name": "${name}", "formatVersion": 2 }\n`,
		'packs/demo.json': JSON.stringify({ description: 'The demo topic and its one rule.', include: { topics: [`${name}/${set}/demo`] } }),
		[`rules/${set}/demo/topic.md`]: '# Demo\n\nThe document the rule argues under.\n',
		[`${rulePath}/rule.md`]: `---\nsummary: a rule the package declares\nchecks: agent\n---\n\n${prose}\n`,
		[`${rulePath}/fixtures/pass/src/example.ts`]: 'export const example = 1;\n',
		[`${rulePath}/fixtures/fail/src/example.ts`]: 'export const example = 2;\n',
	};

	for (const [path, content] of Object.entries(files)) {
		const absolutePath = join(packagePath, path);

		mkdirSync(dirname(absolutePath), { recursive: true });
		writeFileSync(absolutePath, content);
	}
};

/**
 * A consumer repo whose manifest carries the given dependencies — which select
 * no standards, since only the config does — holding the declared standards
 * libraries.
 */
const setupStandards = ({ dependencies, packages = [] }: { dependencies?: Record<string, string>; packages?: StandardsPackage[] } = {}) => {
	const captured = captureCommandOutput();
	const cwd = mkdtempSync(join(tmpdir(), 'lightsout-planning-standards-'));

	writeFileSync(join(cwd, 'package.json'), JSON.stringify({ name: 'consumer', dependencies: dependencies ?? {} }));

	for (const declared of packages) {
		writeStandardsPackage({ cwd, ...declared });
	}

	return { cwd, ...captured };
};

/** The gate config every LightsoutConfig needs, so each case only states the standards keys it is about. */
const configWith = (fields: Partial<LightsoutConfig>): LightsoutConfig => ({ gates: { check: 'true', test: 'true', 'test-coverage': false }, ...fields });

test('readPlanningStandards: with no config it loads nothing, whatever the consumer manifest declares', async () => {
	const { cwd, logged } = setupStandards({ dependencies: { react: '^19.0.0' } });

	const standards = await readPlanningStandards({ cwd, config: undefined });

	// standards are opt-in: a react dependency selects no pack
	expect(standards).toBe(undefined);
	expect(logged).toStrictEqual([]);
});

test('readPlanningStandards: a config naming the shipped standards pack loads its code prose, without the TanStack Start topic in a repo that declares no TanStack Start', async () => {
	const { cwd, logged } = setupStandards();

	const standards = await readPlanningStandards({ cwd, config: configWith({ 'standards-pack': 'lightsout/standards' }) });

	expect(standards ?? '').toMatch(/<!-- lightsout: code\/fractal\/modules -->/);
	expect((standards ?? '').includes('code/frameworks/tanstack-start')).toBeFalsy();
	expect(logged).toStrictEqual([]);
});

test('readPlanningStandards: standards turned off explicitly loads nothing at all', async () => {
	const { cwd, logged } = setupStandards();

	const standards = await readPlanningStandards({ cwd, config: configWith({ 'standards-pack': false }) });

	expect(standards).toBe(undefined);
	expect(logged).toStrictEqual([]);
});

test('readPlanningStandards: planning gets the code set only — the test tree is not its business', async () => {
	const { cwd } = setupStandards();

	const standards = await readPlanningStandards({ cwd, config: configWith({ 'standards-pack': 'lightsout/standards' }) });

	// the code set did load, so a missing tests marker is the set left out and not standards switched off
	expect(standards ?? '').toMatch(/<!-- lightsout: code\//);
	expect((standards ?? '').includes('<!-- lightsout: tests/')).toBeFalsy();
});

test('readPlanningStandards: a package carrying only a test tree contributes nothing, and that is not a failure', async () => {
	const { cwd, logged } = setupStandards({
		packages: [{ at: 'standards/tests-only', name: 'tests-only', ruleId: 'mock-prefix', prose: 'Name mocks so they read as mocks.', set: 'tests' }],
	});

	const standards = await readPlanningStandards({
		cwd,
		config: configWith({ 'standards-libraries': { 'tests-only': './standards/tests-only' }, 'standards-pack': 'tests-only/demo' }),
	});

	// the package loaded fine — it simply has no code set, so planning gets nothing and nothing is narrated
	expect(standards).toBe(undefined);
	expect(logged).toStrictEqual([]);
});

test('readPlanningStandards: a declared standards pack that does not exist is non-fatal — it narrates and returns nothing', async () => {
	const { cwd, logged, errors } = setupStandards();

	const standards = await readPlanningStandards({ cwd, config: configWith({ 'standards-pack': 'lightsout/missing-standards' }) });

	// planning continues without standards rather than dying on them
	expect(standards).toBe(undefined);
	expect(logged.length).toBe(1);
	expect(logged[0] ?? '').toBe('standards not loaded (non-fatal): pack lightsout/missing-standards: names no pack');
	expect(errors).toStrictEqual([]);
});

test("readPlanningStandards: planning reads the selected pack's code prose", async () => {
	const { cwd, logged } = setupStandards({ dependencies: { '@tanstack/react-start': '^1.0.0' } });

	const switchedOff = await readPlanningStandards({ cwd, config: configWith({ 'standards-pack': false }) });
	const named = await readPlanningStandards({ cwd, config: configWith({ 'standards-pack': 'lightsout/standards' }) });

	// standards-pack false selects no pack; lightsout/standards carries the TanStack Start topic beside the fractal ones, for a package declaring TanStack Start
	expect(switchedOff).toBe(undefined);
	expect(named ?? '').toMatch(/<!-- lightsout: code\/fractal\/modules -->/);
	expect(named ?? '').toMatch(/<!-- lightsout: code\/frameworks\/tanstack-start -->/);
	expect((named ?? '').includes('<!-- lightsout: tests/')).toBeFalsy();
	expect(logged).toStrictEqual([]);
});
