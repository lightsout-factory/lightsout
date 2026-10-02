import { expect, test } from '@jest/globals';
import { readRuleTotals } from '#tests/helpers/readRuleTotals.ts';
import { runCli } from '#tests/helpers/runCli.ts';
import { seedStandardsFixture } from '#tests/helpers/seedStandardsFixture.ts';

test('cli: standards-health reports every rule as machine-checked or judgment, and exits 0', async () => {
	const { cwd } = await seedStandardsFixture();

	const { stdout, stderr, code } = await runCli({ args: ['standards-health', '--cwd', cwd] });

	// the coverage claim is counted off the package's own folders, so it lands
	// even in a repo that has never run anything
	expect(stdout).toMatch(/│ lightsout\/synonym-export-name\s+│\s+code\s+│/);
	expect(stdout).toMatch(/│ lightsout\/module-exports\s+│\s+judgment\s+│/);
	// a repo with no refactor history has nothing to say about declines, and says
	// so with a dash rather than a zero that would read as "never declined"
	expect(stdout).toMatch(/│ lightsout\/synonym-export-name\s+│\s+code\s+│\s+—\s+│\s+—\s+│\s+—\s+│\s+—\s+│\s+—\s+│\s+—\s+│\s+—\s+│/);
	// every rule is counted once, as checked by code or by judgment
	const totals = readRuleTotals({ stdout });
	expect((totals.code ?? 0) + (totals.judgment ?? 0)).toBe(totals.rules);
	// it reports on the rules, never on the code — nothing here to gate on
	expect(stderr).toBe('');
	expect(code).toBe(0);
});
