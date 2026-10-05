import type { StandardsPackListing } from '@lightsout/engine';
import { packFrameworks } from '#src/features/packs/internal/common/constants/packFrameworks.ts';

interface Params {
	packs: StandardsPackListing[];
}

/**
 * The built-in packs in the order `packFrameworks` lists them, then every
 * other pack in the order it arrived.
 */
export const sortPacksForDisplay = ({ packs }: Params): StandardsPackListing[] => {
	const displayOrder = Object.keys(packFrameworks);
	const rankOf = ({ pack }: { pack: StandardsPackListing }) => {
		const rank = displayOrder.indexOf(pack.address);

		return rank === -1 ? displayOrder.length : rank;
	};

	return [...packs].sort((first, second) => rankOf({ pack: first }) - rankOf({ pack: second }));
};
