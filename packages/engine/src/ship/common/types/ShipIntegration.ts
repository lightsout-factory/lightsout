import type { LightsoutConfig } from '#src/contracts/LightsoutConfig.ts';
import type { Driver } from '#src/drivers/common/types/Driver.ts';

// Required on `runShip` rather than optional, so the compiler stops a new
// shipping path from being added without the safety contract.
export interface ShipIntegration {
	config: LightsoutConfig;
	driver: Driver;
}
