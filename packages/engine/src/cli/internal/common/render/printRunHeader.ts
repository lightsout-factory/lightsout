import { printConfigSource } from '#src/cli/internal/common/render/printConfigSource.ts';
import { defaultAgentTimeoutMinutes } from '#src/common/constants/defaultAgentTimeoutMinutes.ts';
import { defaultGateTimeoutMinutes } from '#src/common/constants/defaultGateTimeoutMinutes.ts';
import { defaultSupervisorTimeoutMinutes } from '#src/common/constants/defaultSupervisorTimeoutMinutes.ts';
import type { Driver } from '#src/common/types/Driver.ts';
import type { StandardsGroup } from '#src/common/types/StandardsGroup.ts';
import { messageOf } from '#src/common/utils/messageOf.ts';
import type { LightsoutConfig } from '#src/contracts/LightsoutConfig/LightsoutConfig.ts';
import { Permissions } from '#src/contracts/Permissions.ts';
import { resolveStandardsGroups } from '#src/standards/resolveStandardsGroups/resolveStandardsGroups.ts';

interface Params {
	config: LightsoutConfig;
	driver: Driver;
	cwd: string;
	/**
	 * The absolute path of the config file the run loaded — not always under `cwd`, which is where the run builds.
	 * Undefined only for a resumed run whose manifest predates the recorded path, and the header then prints no config line.
	 */
	configPath: string | undefined;
}

/** The pack a group's config names, then the conditional packs its packages' dependencies brought in. */
const describePack = ({ group }: { group: StandardsGroup }) =>
	group.pack.conditionalPacks.length === 0 ? group.pack.name : `${group.pack.name} (with ${group.pack.conditionalPacks.join(', ')})`;

/** The root's standards, then one indented line for each package whose standards differ from the root's. */
const standardsLinesOf = ({ groups, config }: { groups: StandardsGroup[]; config: LightsoutConfig }) => {
	const root = groups.find((group) => group.packages.includes(''));
	const packageLines = groups
		.filter((group) => group !== root)
		.flatMap((group) => group.packages.filter((name) => name !== '').map((name) => ({ name, description: describePack({ group }) })))
		.sort((first, second) => first.name.localeCompare(second.name))
		.map(({ name, description }) => `    ${name}: ${description}`);
	// An unset key and an explicit `false` both mean none, and the line says which the config holds.
	const noneReason = config['standards-pack'] === false ? 'standards-pack false' : 'no standards-pack';
	const rootLine = root === undefined ? `  repo root: none (${noneReason})` : `  repo root: ${describePack({ group: root })}`;

	return [rootLine, ...packageLines];
};

/** Never throws: the header only reports, and `prepareRun` makes the same failure the run's error. */
const describeStandards = async ({ config, cwd }: { config: LightsoutConfig; cwd: string }) => {
	let lines: string[];

	try {
		lines = standardsLinesOf({ groups: await resolveStandardsGroups({ cwd, config }), config });
	} catch (error) {
		lines = [`  standards: will not load — ${messageOf({ error })}`];
	}

	return lines;
};

export const printRunHeader = async ({ config, driver, cwd, configPath }: Params): Promise<void> => {
	const coverage = config.gates['test-coverage'] === false ? 'off (explicit)' : config.gates['test-coverage'];

	console.log(`  cwd: ${cwd}`);
	// printConfigSource reads undefined as a checkout with no config file, which a run that recorded no path need not be.
	if (configPath !== undefined) {
		printConfigSource({ configPath });
	}

	for (const line of await describeStandards({ config, cwd })) {
		console.log(line);
	}

	console.log(
		`  harness: ${driver.name} · model: ${config.model ?? 'harness default'} · effort: ${config.effort ?? 'harness default'} · permissions: ${config.permissions ?? Permissions.Write}`,
	);
	console.log(
		`  timeouts: agent ${config.timeouts?.['agent-minutes'] ?? defaultAgentTimeoutMinutes}m · supervisor ${config.timeouts?.['supervisor-minutes'] ?? defaultSupervisorTimeoutMinutes}m · gate ${config.timeouts?.['gate-minutes'] ?? defaultGateTimeoutMinutes}m`,
	);
	console.log(`  gates (root): check=[${config.gates.check}] test=[${config.gates.test}] coverage=[${coverage}]`);

	if (config.gates.generate) {
		console.log(`  generate (before every gate set): [${config.gates.generate}]`);
	}

	if (config['agent-commands'] && config['agent-commands'].length > 0) {
		console.log(`  agent commands (granted, prefix match): ${config['agent-commands'].map((command) => `[${command}]`).join(' ')}`);
	}

	if (config.generated) {
		console.log(`  generated (never attributed): ${config.generated.join(', ')}`);
	}

	if (config.vendored) {
		console.log(`  vendored (never checked, still attributed): ${config.vendored.join(', ')}`);
	}

	if (config.gates.build) {
		console.log(`  gates (root, opt-in): build=[${config.gates.build}]`);
	}

	if (config.gates.format) {
		console.log(`  format: [${config.gates.format}]`);
	}

	if (config['package-gates']) {
		const scopedCoverage = config['package-gates']['test-coverage'] ? ` coverage=[${config['package-gates']['test-coverage']}]` : '';

		console.log(`  gates (per package): check=[${config['package-gates'].check}] test=[${config['package-gates'].test}]${scopedCoverage}`);
	}
};
