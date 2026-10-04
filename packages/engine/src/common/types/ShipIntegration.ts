import type { Driver } from '#src/common/types/Driver.ts';
import type { LightsoutConfig } from '#src/contracts/LightsoutConfig/LightsoutConfig.ts';

// Required on `runShip` rather than optional, so the compiler stops a new
// shipping path from being added without the safety contract.
export interface ShipIntegration {
	config: LightsoutConfig;
	driver: Driver;
}
