import { readConfig } from '#src/common/config/readConfig.ts';
import { defaultPackagesDir } from '#src/common/constants/defaultPackagesDir.ts';
import { messageOf } from '#src/common/utils/messageOf.ts';
import type { LightsoutConfig } from '#src/contracts/LightsoutConfig.ts';
import { checkConfiguredPaths } from '#src/doctor/checkConfiguredPaths.ts';
import { checkCoverageSummary } from '#src/doctor/checkCoverageSummary.ts';
import { checkGitignore } from '#src/doctor/checkGitignore.ts';
import { checkHarness } from '#src/doctor/checkHarness.ts';
import { checkHarnessUsage } from '#src/doctor/checkHarnessUsage.ts';
import { checkJestMocks } from '#src/doctor/checkJestMocks.ts';
import { checkJestReporter } from '#src/doctor/checkJestReporter.ts';
import { checkLintRules } from '#src/doctor/checkLintRules.ts';
import { checkRuleRequirements } from '#src/doctor/checkRuleRequirements.ts';
import { checkScriptBinaries } from '#src/doctor/checkScriptBinaries.ts';
import { checkSourceWalk } from '#src/doctor/checkSourceWalk.ts';
import { checkUserEvent } from '#src/doctor/checkUserEvent.ts';
import type { DoctorCheck } from '#src/doctor/internal/common/types/DoctorCheck.ts';
import { resolvePackageDirs } from '#src/doctor/internal/resolvePackageDirs.ts';
import type { Driver } from '#src/drivers/common/types/Driver.ts';

const severityRank: Record<DoctorCheck['status'], number> = { pass: 0, note: 1, warn: 2, fail: 3 };

const pushOptional = ({ checks, check }: { checks: DoctorCheck[]; check: DoctorCheck | undefined }) => {
	if (check) {
		checks.push(check);
	}
};

const configuredPathAudits = ({ config }: { config: LightsoutConfig }) =>
	[
		{ id: 'generated', paths: config.generated, fix: 'run the generator once, or remove stale entries from `generated`' },
		{ id: 'vendored', paths: config.vendored, fix: 'restore the third-party code, or remove stale entries from `vendored`' },
	] as const;

interface Params {
	cwd: string;
	/** Test seam for the harness binary probe — defaults to running `<binary> --version`. */
	probeHarness?: (params: { binary: string }) => Promise<{ exitCode: number; stdout: string; stderr: string }>;
	/** Run the opt-in harness-usage probe, which spawns one real agent call. Default false. */
	usageProbe?: boolean;
	/** Test seam for that probe's agent call — defaults to the driver the config names. */
	usageDriver?: Driver;
}

/**
 * The doctor never mutates: repo-wide changes such as `clearMocks: true` are a
 * human's decision to apply and verify.
 */
export const runDoctor = async ({ cwd, probeHarness, usageProbe, usageDriver }: Params): Promise<DoctorCheck[]> => {
	const checks: DoctorCheck[] = [];

	let config: LightsoutConfig;

	try {
		config = await readConfig({ cwd });
	} catch (error) {
		return [
			{
				id: 'config',
				status: 'fail',
				detail: messageOf({ error }),
				fix: 'create or repair lightsout.config.json — every other check depends on it',
			},
		];
	}

	const packagesDir = config['packages-dir'] ?? defaultPackagesDir;

	checks.push({
		id: 'config',
		status: 'pass',
		detail: `lightsout.config.json valid · harness ${config.harness ?? 'claude-code'}${config['package-gates'] ? ` · monorepo (${packagesDir}/)` : ''}`,
	});

	checks.push(await checkHarness({ cwd, config, probeHarness }));

	// Only when asked for: the probe spends real money on the user's subscription.
	if (usageProbe) {
		checks.push(await checkHarnessUsage({ cwd, config, driver: usageDriver }));
	}

	checks.push(await checkGitignore({ cwd }));
	checks.push(await checkSourceWalk({ cwd, generated: config.generated }));

	const { packageDirs, scopedGatesCheck } = await resolvePackageDirs({ cwd, config, packagesDir });

	pushOptional({ checks, check: scopedGatesCheck });
	pushOptional({ checks, check: await checkJestMocks({ cwd, packageDirs }) });
	pushOptional({ checks, check: await checkJestReporter({ cwd, packageDirs }) });
	pushOptional({ checks, check: await checkUserEvent({ packageDirs }) });
	pushOptional({ checks, check: await checkLintRules({ config, packageDirs }) });
	pushOptional({ checks, check: await checkRuleRequirements({ cwd, config }) });

	for (const audit of configuredPathAudits({ config })) {
		pushOptional({ checks, check: await checkConfiguredPaths({ cwd, ...audit }) });
	}

	pushOptional({ checks, check: await checkCoverageSummary({ config, packageDirs }) });
	checks.push(await checkScriptBinaries({ cwd, config }));

	// Actionable items last, nearest the prompt.
	return checks.sort((a, b) => severityRank[a.status] - severityRank[b.status]);
};
