import type { StandardsFinding } from '@lightsout/engine';

interface Params {
	/** The finding whose first file — its site — decides the label. */
	finding: StandardsFinding;
	/** How many leading path segments the label keeps. */
	depth: number;
}

/**
 * A finding's first file is its site. The last segment is dropped only when it
 * contains a dot, so a folder site from a structure rule keeps it, matching the
 * engine's `buildDominantPathNote`. The folder breakdown and the findings table
 * must place a finding identically, so both use this.
 */
export const getFindingFolder = ({ finding, depth }: Params): string => {
	const site = finding.files[0]?.path;

	if (site === undefined) {
		return '.';
	}

	const segments = site.split('/');
	const withoutFile = segments[segments.length - 1].includes('.') ? segments.slice(0, -1) : segments;

	return withoutFile.slice(0, depth).join('/') || '.';
};
