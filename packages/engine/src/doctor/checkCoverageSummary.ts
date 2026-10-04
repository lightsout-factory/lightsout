import { stat } from 'node:fs/promises';
import { join } from 'node:path';
import { defaultCoverageSummaryPath } from '#src/common/constants/defaultCoverageSummaryPath.ts';
import type { LightsoutConfig } from '#src/contracts/LightsoutConfig/LightsoutConfig.ts';
import type { DoctorCheck } from '#src/doctor/internal/common/types/DoctorCheck.ts';
import type { PackageDir } from '#src/doctor/internal/common/types/PackageDir.ts';

interface Params {
	config: LightsoutConfig;
	/** Root + scoped packages, as resolvePackageDirs returns them — each `dir` absolute. */
	packageDirs: PackageDir[];
}

/**
 * Only existence is checked, so a repo can measure with any tool that writes the
 * file. Missing is a warn: a fresh clone has never run its coverage script.
 */
export const checkCoverageSummary = async ({ config, packageDirs }: Params): Promise<DoctorCheck | undefined> => {
	const scoped = config['package-gates']?.['test-coverage'];
	const rootApplies = typeof config.gates['test-coverage'] === 'string';

	if (!scoped && !rootApplies) {
		return undefined;
	}

	const summaryPath = config['coverage-summary-path'] ?? defaultCoverageSummaryPath;
	// Same rule as the coverage run: a scoped command means the packages are the measurement.
	const scopes = scoped ? packageDirs.filter((entry) => entry.label !== 'root') : packageDirs.filter((entry) => entry.label === 'root');
	const expected = scopes.map((entry) => ({ label: entry.label, path: join(entry.dir, summaryPath) }));
	const absent: string[] = [];

	for (const entry of expected) {
		await stat(entry.path).catch(() => absent.push(`${entry.label}: ${summaryPath}`));
	}

	return absent.length === 0
		? { id: 'coverage-summary', status: 'pass', detail: `coverage summary found for ${expected.length} scope(s)` }
		: {
				id: 'coverage-summary',
				status: 'warn',
				detail: `not found: ${absent.join(', ')}`,
				fix: `configure a json-summary coverage reporter (jest: coverageReporters ['json-summary']) writing ${summaryPath}, run the coverage script once, or set coverage-summary-path`,
			};
};
