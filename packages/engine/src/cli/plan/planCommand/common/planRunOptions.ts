import { createProgressPrinter } from '#src/cli/common/createProgressPrinter.ts';
import type { Driver } from '#src/common/types/Driver.ts';
import type { Effort } from '#src/contracts/Effort.ts';
import type { LightsoutConfig } from '#src/contracts/LightsoutConfig/LightsoutConfig.ts';
import type { Permissions } from '#src/contracts/Permissions.ts';

interface Params {
	cwd: string;
	driver: Driver;
	name: string;
	standards: string | undefined;
	config: LightsoutConfig | undefined;
}

interface PlanRunOptions {
	cwd: string;
	driver: Driver;
	name: string;
	standards: string | undefined;
	model: string | undefined;
	effort: Effort | undefined;
	permissions: Permissions | undefined;
	onProgress: (message: string) => void;
}

export const planRunOptions = ({ cwd, driver, name, standards, config }: Params): PlanRunOptions => ({
	cwd,
	driver,
	name,
	standards,
	model: config?.model,
	effort: config?.effort,
	permissions: config?.permissions,
	onProgress: createProgressPrinter(),
});
