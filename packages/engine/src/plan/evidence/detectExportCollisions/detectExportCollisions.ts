import type { ExportCollision } from '#src/common/types/ExportCollision.ts';
import type { ExportCensus } from '#src/plan/common/types/ExportCensus.ts';
import { getNameKey } from '#src/plan/evidence/common/getNameKey.ts';
import { collapseCasing } from '#src/plan/evidence/detectExportCollisions/collapseCasing.ts';

interface Params {
	census: ExportCensus;
	symbols: string[];
}

/**
 * Must match `detectPriorArtCandidates`' comparator exactly. A name differing
 * only by casing or separators is exempt: `GetStarted` beside `get-started` is a
 * framework pair, not a duplicate.
 */
export const detectExportCollisions = ({ census, symbols }: Params): ExportCollision[] => {
	const collisions: ExportCollision[] = [];

	for (const symbol of symbols) {
		if (symbol === 'index') {
			continue;
		}

		const bucket = census.get(getNameKey({ name: symbol })) ?? [];
		const collidesWith = bucket.filter((entry) => entry.name === symbol || collapseCasing({ name: entry.name }) !== collapseCasing({ name: symbol }));

		if (collidesWith.length > 0) {
			collisions.push({ symbol, collidesWith });
		}
	}

	return collisions;
};
