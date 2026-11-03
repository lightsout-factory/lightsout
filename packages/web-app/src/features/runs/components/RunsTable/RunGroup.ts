import type { RunListing } from '@lightsout/engine';

export interface RunGroup {
	run: RunListing;
	children: RunListing[];
}
