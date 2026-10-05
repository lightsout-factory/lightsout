import { expect, test } from '@jest/globals';
import { readRuleTotals } from '#tests/helpers/readRuleTotals.ts';
import { runCli } from '#tests/helpers/runCli.ts';
import { seedStandardsFixture } from '#tests/helpers/seedStandardsFixture.ts';

test('cli: standards-health reports every rule as deterministic or agent, and exits 0', async () => {
	const { cwd } = await seedStandardsFixture();

	const { stdout, stderr, code } = await runCli({ args: ['standards-health', '--cwd', cwd] });

	// the coverage claim is counted off the package's own folders, so it lands
	// even in a repo that has never run anything
	expect(stdout).toMatch(/│ lightsout\/duplicate-export-name\s+│\s+deterministic\s+│/);
	expect(stdout).toMatch(/│ lightsout\/object-args\s+│\s+agent\s+│/);
	// a repo with no refactor history has nothing to say about declines, and says
	// so with a dash rather than a zero that would read as "never declined"
	expect(stdout).toMatch(/│ lightsout\/duplicate-export-name\s+│\s+deterministic\s+│\s+—\s+│\s+—\s+│\s+—\s+│\s+—\s+│\s+—\s+│\s+—\s+│\s+—\s+│/);
	// every rule is counted as deterministic or agent, and a rule with both kinds
	// of check is counted under both
	const totals = readRuleTotals({ stdout });
	expect((totals.deterministic ?? 0) + (totals.agent ?? 0)).toBe((totals.rules ?? 0) + totals.bothWays);
	// it reports on the rules, never on the code — nothing here to gate on
	expect(stderr).toBe('');
	expect(code).toBe(0);
});
