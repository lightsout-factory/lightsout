import type { Driver } from '#src/common/types/Driver.ts';
import type { LightsoutConfig } from '#src/contracts/LightsoutConfig/LightsoutConfig.ts';
import { Permissions } from '#src/contracts/Permissions.ts';

interface Params {
	driver: Driver;
	/** The effective config — its model, effort and permissions are the ones the driver will be handed. Undefined when the checkout has none. */
	config: LightsoutConfig | undefined;
}

/**
 * Printed before the first spawn by every command that bills a harness, so a
 * run on the wrong one is visible before it costs anything rather than only in
 * the report afterwards.
 */
export const printHarnessLine = ({ driver, config }: Params): void => {
	console.log(
		`  harness: ${driver.name} · model: ${config?.model ?? 'harness default'} · effort: ${config?.effort ?? 'harness default'} · permissions: ${config?.permissions ?? Permissions.Write}`,
	);
};
