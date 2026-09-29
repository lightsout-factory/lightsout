import { usage } from '#src/cli/common/constants/usage.ts';
import type { CommandContext } from '#src/cli/common/types/CommandContext.ts';
import { exitCli } from '#src/cli/common/utils/exitCli.ts';
import { dim } from '#src/cli/internal/common/terminal/dim.ts';
import { green } from '#src/cli/internal/common/terminal/green.ts';
import { red } from '#src/cli/internal/common/terminal/red.ts';
import { yellow } from '#src/cli/internal/common/terminal/yellow.ts';
import { readOptionalConfig } from '#src/common/config/readOptionalConfig.ts';
import { runDoctor } from '#src/doctor/runDoctor.ts';

// A config that does not parse is left to the doctor's own `config` check, which
// reports it a line later; a throw here would replace that report.
const warnBeforeProbing = async ({ cwd }: { cwd: string }) => {
	const config = await readOptionalConfig({ cwd }).catch(() => undefined);

	console.log(`--usage-probe: about to spend one real agent call on ${config?.harness ?? 'claude-code'} — it bills your own subscription.`);
};

/**
 * `--usage-probe` is the one check that is not free: it spends a real agent call
 * on the user's own subscription, so it runs only when asked for, and a
 * value-carrying form is a usage error.
 */
export const doctorCommand = async ({ cwd, flags }: CommandContext): Promise<void> => {
	const usageProbe = flags.has('usage-probe');

	if (usageProbe && flags.get('usage-probe') !== true) {
		console.error(usage);
		return exitCli({ code: 1 });
	}

	if (usageProbe) {
		await warnBeforeProbing({ cwd });
	}

	const checks = await runDoctor({ cwd, usageProbe });
	const icon = { pass: green('✓'), note: dim('ℹ'), warn: yellow('⚠'), fail: red('✗') };
	const counts = { pass: 0, note: 0, warn: 0, fail: 0 };

	console.log(`doctor    ${cwd}\n`);

	for (const check of checks) {
		counts[check.status] += 1;
		console.log(`${icon[check.status]} ${check.id.padEnd(16)}${check.detail}`);

		if (check.fix) {
			for (const line of check.fix.split('\n')) {
				console.log(dim(`  ${''.padEnd(16)}${line}`));
			}
		}
	}

	const tally = Object.entries(counts)
		.filter(([, count]) => count > 0)
		.map(([status, count]) => `${count} ${status}`)
		.join(' · ');

	console.log(`\n${checks.length} check(s) · ${tally}`);
	return exitCli({ code: counts.fail > 0 ? 1 : 0 });
};
