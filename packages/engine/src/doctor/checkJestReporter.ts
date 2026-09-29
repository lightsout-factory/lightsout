import { createRequire } from 'node:module';
import { testReporterEnv } from '#src/common/constants/testReporterEnv.ts';
import type { DoctorCheck } from '#src/doctor/internal/common/types/DoctorCheck.ts';
import type { PackageDir } from '#src/doctor/internal/common/types/PackageDir.ts';
import { findJestConfigs } from '#src/doctor/internal/common/utils/findJestConfigs.ts';

/** A path no repository would name by hand, so finding it in `reporters` can only mean the config read the variable. */
const sentinel = '/lightsout/doctor/jest-reporter-probe.cjs';

const carriesSentinel = ({ reporters }: { reporters: unknown }) =>
	Array.isArray(reporters) && reporters.some((entry: unknown) => entry === sentinel || (Array.isArray(entry) && entry[0] === sentinel));

const configOf = ({ loaded }: { loaded: unknown }) => (typeof loaded === 'object' && loaded !== null && 'jest' in loaded ? loaded.jest : loaded);

// A function or promise config has no `reporters` readable synchronously, so it is unknown, never missing.
const readableConfig = ({ config }: { config: unknown }): Record<string, unknown> | undefined =>
	typeof config === 'object' && config !== null && !('then' in config && typeof config.then === 'function') ? { ...config } : undefined;

/**
 * Loads the config rather than searching its text: a config built by a shared
 * factory never mentions the variable in the file the walk finds.
 */
const inspectConfig = ({ configPath }: { configPath: string }) => {
	const previous = process.env[testReporterEnv.reporter];

	process.env[testReporterEnv.reporter] = sentinel;

	try {
		const loaded: unknown = createRequire(configPath)(configPath);
		const config = readableConfig({ config: configOf({ loaded }) });

		if (config === undefined) {
			return undefined;
		}

		return { carries: carriesSentinel({ reporters: config.reporters }) };
	} catch {
		return undefined;
	} finally {
		if (previous === undefined) {
			delete process.env[testReporterEnv.reporter];
		} else {
			process.env[testReporterEnv.reporter] = previous;
		}
	}
};

interface Params {
	cwd: string;
	packageDirs: PackageDir[];
}

/**
 * Without the reporter a run can be green on gates while proving nothing about
 * the tests its plan named. The doctor never applies the fix: adding a reporter
 * changes what every test command in the repository does.
 */
export const checkJestReporter = async ({ cwd, packageDirs }: Params): Promise<DoctorCheck | undefined> => {
	const missing: string[] = [];
	const unchecked: string[] = [];
	let configCount = 0;

	for (const { label, dir } of packageDirs) {
		for (const configPath of await findJestConfigs({ packageDir: dir })) {
			configCount += 1;

			const inspected = inspectConfig({ configPath });
			const where = `${label}: ${configPath.slice(cwd.length + 1)}`;

			if (inspected === undefined) {
				unchecked.push(`${where} (unchecked — could not be read as a configuration object)`);
			} else if (!inspected.carries) {
				missing.push(where);
			}
		}
	}

	if (configCount === 0) {
		return undefined;
	}

	return missing.length === 0
		? { id: 'jest-reporter', status: 'pass', detail: ["every loadable Jest config loads the engine's per-test reporter", ...unchecked].join('; ') }
		: {
				id: 'jest-reporter',
				status: 'warn',
				detail: [...missing, ...unchecked].join('; '),
				fix: `add the engine's reporter to each Jest config — \`const lightsoutReporter = process.env.${testReporterEnv.reporter}; reporters: lightsoutReporter ? ['default', lightsoutReporter] : ['default']\` — naming the \`reporters\` key replaces Jest's default, so 'default' must be restated`,
			};
};
