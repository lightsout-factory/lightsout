import { printRunHeader } from '#src/cli/internal/common/render/printRunHeader.ts';
import type { PlanTarget } from '#src/cli/internal/common/types/PlanTarget.ts';
import type { LightsoutConfig } from '#src/contracts/LightsoutConfig/LightsoutConfig.ts';
import type { Driver } from '#src/drivers/common/types/Driver.ts';

interface Params {
	target: PlanTarget;
	overviewPath: string | undefined;
	packages: string[] | undefined;
	startPhase: number | undefined;
	config: LightsoutConfig;
	driver: Driver;
	cwd: string;
	configPath: string;
}

export const printRunStart = async ({ target, overviewPath, packages, startPhase, config, driver, cwd, configPath }: Params): Promise<void> => {
	console.log(`lightsout: starting run`);
	console.log(
		'overviewPath' in target
			? `  overview: ${target.overviewPath}${startPhase === undefined ? '' : `\n  start phase: ${startPhase}`}`
			: `  plan: ${target.planPath}${overviewPath ? `\n  overview: ${overviewPath}` : ''}${packages ? `\n  packages flag: ${packages.join(', ')}` : ''}`,
	);
	await printRunHeader({ config, driver, cwd, configPath });
};
