import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { expect, jest, test } from '@jest/globals';
import { freshCwd } from '#tests/helpers/freshCwd.ts';
import { readRuleTotals } from '#tests/helpers/readRuleTotals.ts';
import { runCli } from '#tests/helpers/runCli.ts';
import { seedStandardsFixture } from '#tests/helpers/seedStandardsFixture.ts';
import { writeRepoFile } from '#tests/helpers/writeRepoFile.ts';

/**
 * A one-rule library the built-in override points at, so a listing read back
 * off it proves the CLI child loaded this folder rather than plugin/standards/.
 * restoreMocks puts the variable back after the test.
 */
const setupEnvStandards = async () => {
	const libraryPath = await freshCwd();
	writeRepoFile({ cwd: libraryPath, path: 'lightsout-standards.json', content: '{ "name": "env-standards", "formatVersion": 1 }\n' });
	writeRepoFile({ cwd: libraryPath, path: 'code/demo/topic.md', content: '# Demo\n\nThe document the rule argues under.\n' });
	writeRepoFile({
		cwd: libraryPath,
		path: 'code/demo/01-only-rule/rule.md',
		content: '---\nsummary: what only-rule catches\nseverity: advisory\n---\n\nThe rule prose.\n',
	});
	jest.replaceProperty(process.env, 'LIGHTSOUT_DEFAULT_STANDARDS', libraryPath);
	const { cwd } = await seedStandardsFixture();

	return { cwd };
};

test('cli: standards-check prints each finding, the rule breakdown, and exits 0', async () => {
	const { cwd } = await seedStandardsFixture();

	const { stdout, stderr, code } = await runCli({ args: ['standards-check', '--code-checks', '--cwd', cwd] });

	expect(stderr).toBe('');
	// each rule gets a heading carrying its severity and count
	expect(stdout).toMatch(/ℹ synonym-export-name · 1 advisory/);
	// the shared guidance is stated once, under the rows it covers
	expect(stdout).toContain('Likely one concept living under two names.');
	// and the tally is a table, closed off by the report path
	expect(stdout).toMatch(/│ synonym-export-name\s+│\s+—\s+│\s+1\s+│/);
	// the rule's summary rides under its own row — a rule id alone says nothing
	expect(stdout).toMatch(/│ two exports that name the same concept with different verbs[^│]*│/);
	expect(stdout).toMatch(/report: \.lightsout\/standards-check\.json\n$/);
	// the standards check reports; it never fails the caller
	expect(code).toBe(0);
});

test('cli: standards-check counts advisories apart from findings and does not call them debt', async () => {
	const { cwd } = await seedStandardsFixture();

	const { stdout, stderr, code } = await runCli({ args: ['standards-check', '--code-checks', '--cwd', cwd] });

	// the fixture plants a synonym pair and nothing else — advice to weigh, and
	// no work
	expect(stdout).toMatch(/│ total\s+│\s+—\s+│\s+1\s+│/);
	// so the accept-as-debt hint stays quiet — advice is not a ledger entry
	expect(stdout.includes('--baseline')).toBeFalsy();
	expect(stderr).toBe('');
	expect(code).toBe(0);
});

test('cli: standards-check writes its typed report to .lightsout/standards-check.json', async () => {
	const { cwd } = await seedStandardsFixture();

	const { code } = await runCli({ args: ['standards-check', '--code-checks', '--cwd', cwd] });

	const report = JSON.parse(await readFile(join(cwd, '.lightsout', 'standards-check.json'), 'utf8'));
	expect(report.path).toBe('.');
	// the evidence file carries the findings, not just the printed summary
	expect(report.findings.some((finding: { rule: string }) => finding.rule === 'synonym-export-name')).toBeTruthy();
	expect(code).toBe(0);
});

test('cli: standards-check renders a degraded check tier as a note instead of failing', async () => {
	const { cwd } = await seedStandardsFixture();

	const { stdout, stderr, code } = await runCli({ args: ['standards-check', '--code-checks', '--cwd', cwd] });

	expect(stdout).toMatch(/ℹ [^\n]*no typescript resolvable from the target repo/);
	expect(stderr).toBe('');
	expect(code).toBe(0);
});

test('cli: standards-check --baseline writes the debt ledger and exits 0', async () => {
	const { cwd } = await seedStandardsFixture();

	const { stdout, stderr, code } = await runCli({ args: ['standards-check', '--code-checks', '--baseline', '--cwd', cwd] });

	const ledger = JSON.parse(await readFile(join(cwd, 'lightsout.standards-baseline.json'), 'utf8'));
	expect(ledger.path).toBe('.');
	// the accepted sites are what future runs measure against
	expect(ledger.siteKeys.length > 0).toBeTruthy();
	expect(stdout).toMatch(/ℹ baseline written: \d+ site\(s\) accepted as existing debt/);
	expect(stderr).toBe('');
	expect(code).toBe(0);
});

test('cli: standards-check reports nothing new once the findings are baselined', async () => {
	const { cwd } = await seedStandardsFixture({ baseline: true });

	const { stdout, stderr, code } = await runCli({ args: ['standards-check', '--code-checks', '--cwd', cwd] });

	// a baselined finding is accepted debt, not news
	expect(stdout.includes('synonym-export-name')).toBeFalsy();
	// nothing left to report reads as a sentence, not an empty table
	expect(stdout).toContain('clean — nothing blocking, no advisories');
	expect(stdout.includes('┌')).toBeFalsy();
	expect(stderr).toBe('');
	expect(code).toBe(0);
});

test('cli: standards-check --all reports the findings the baseline already accepted', async () => {
	const { cwd } = await seedStandardsFixture({ baseline: true });

	const { stdout, stderr, code } = await runCli({ args: ['standards-check', '--code-checks', '--all', '--cwd', cwd] });

	// a baselined site is printed again under --all
	expect(stdout).toMatch(/ℹ synonym-export-name · 1 advisory/);
	expect(stderr).toBe('');
	expect(code).toBe(0);
});

test('cli: standards-check --list prints the enforcement ledger and runs no check', async () => {
	const { cwd } = await seedStandardsFixture();

	const { stdout, stderr, code } = await runCli({ args: ['standards-check', '--list', '--cwd', cwd] });

	// every rule is listed with the state it runs at, who checks it, and the doc it enforces
	expect(stdout).toMatch(/│ synonym-export-name\s+│\s+advisory\s+│\s+code\s+│\s+lightsout-defaults: code\/style-guide\/conventions\/naming\s+│/);
	expect(stdout).toMatch(/│ type-assertion\s+│\s+blocking\s+│\s+code\s+│/);
	// a rule no check covers is listed too, and says so
	expect(stdout).toMatch(/│ path-aliases\s+│\s+advisory\s+│\s+judgment\s+│\s+lightsout-defaults: code\/style-guide\/structure\/import-paths\s+│/);
	// a rule's live numbers ride its summary line
	expect(stdout).toContain('minTokens 50');
	// the totals close it off, counting every rule once by state and once by
	// who checks it
	const totals = readRuleTotals({ stdout });
	expect({
		byState: (totals.blocking ?? 0) + (totals.advisory ?? 0) + (totals.off ?? 0),
		byChecker: (totals.code ?? 0) + (totals.judgment ?? 0),
	}).toStrictEqual({
		byState: totals.rules,
		byChecker: totals.rules,
	});
	// the test-shape rules name the document they enforce
	expect(stdout).toMatch(/│ test-nested-describe\s+│\s+advisory\s+│\s+code\s+│\s+lightsout-defaults: tests\/unit-testing\s+│/);
	// and so do the file-placement rules, across the three docs they come from
	expect(stdout).toMatch(/│ banned-folder-name\s+│\s+advisory\s+│\s+code\s+│\s+lightsout-defaults: code\/architecture\/folder-structure\s+│/);
	expect(stdout).toMatch(/│ folder-index-file\s+│\s+advisory\s+│\s+code\s+│\s+lightsout-defaults: code\/style-guide\/structure\/module-api\s+│/);
	expect(stdout).toMatch(/│ folder-casing\s+│\s+advisory\s+│\s+code\s+│\s+lightsout-defaults: code\/architecture\/folder-structure\s+│/);
	// --list answers a question about configuration — it never checks the tree
	expect(stdout.includes('report: .lightsout/standards-check.json')).toBeFalsy();
	expect(stderr).toBe('');
	expect(code).toBe(0);
});

test('cli: standards-check --list marks the rules this repo configured', async () => {
	const { cwd } = await seedStandardsFixture({ config: { 'standards-rule-settings': { 'synonym-export-name': 'off' } } });
	const { cwd: defaultCwd } = await seedStandardsFixture();

	const { stdout, code } = await runCli({ args: ['standards-check', '--list', '--cwd', cwd] });
	const { stdout: defaultStdout } = await runCli({ args: ['standards-check', '--list', '--cwd', defaultCwd] });

	// "this is our policy" reads apart from "this is the default"
	expect(stdout).toMatch(/│ synonym-export-name\s+│\s+off \(config\)\s+│/);
	// and the totals move by exactly that one advisory rule turned off
	const totals = readRuleTotals({ stdout: defaultStdout });
	expect(readRuleTotals({ stdout })).toStrictEqual({ ...totals, advisory: (totals.advisory ?? 0) - 1, off: (totals.off ?? 0) + 1 });
	expect(code).toBe(0);
});

test('cli: standards-check --path narrows the run to one subtree', async () => {
	const { cwd } = await seedStandardsFixture();

	const { stdout, stderr, code } = await runCli({ args: ['standards-check', '--code-checks', '--path', 'src/a', '--cwd', cwd] });

	// the synonym pair is split by the narrowed scope, so tier 0 has nothing to
	// pair
	expect(stdout.includes('synonym-export-name')).toBeFalsy();
	const report = JSON.parse(await readFile(join(cwd, '.lightsout', 'standards-check.json'), 'utf8'));
	// the flag reaches the engine as the checked subpath
	expect(report.path).toBe('src/a');
	expect(stderr).toBe('');
	expect(code).toBe(0);
});

test('cli: standards-check --list loads the built-in library that LIGHTSOUT_DEFAULT_STANDARDS names', async () => {
	const { cwd } = await setupEnvStandards();

	const { stdout, stderr, code } = await runCli({ args: ['standards-check', '--list', '--cwd', cwd] });

	expect(stdout).toMatch(/│ only-rule\s+│\s+advisory\s+│\s+judgment\s+│\s+env-standards: code\/demo\s+│/);
	// the committed plugin copy never loaded beside it
	expect(stdout).not.toMatch(/│\s+lightsout-defaults:/);
	expect(stderr).toBe('');
	expect(code).toBe(0);
});
