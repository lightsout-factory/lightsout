/**
 * Shared by `preShip.mjs` and `checkShipped.mjs`, which run in the same hook:
 * two statements of the rule could let preparation write a version the check
 * then refuses.
 */
export const isNewer = ({ head, base }) => {
	const segments = ({ version }) => version.split('.').map((segment) => Number.parseInt(segment, 10) || 0);
	const [headSegments, baseSegments] = [segments({ version: head }), segments({ version: base })];
	let verdict = false;

	for (let index = 0; index < Math.max(headSegments.length, baseSegments.length); index += 1) {
		const [left, right] = [headSegments[index] ?? 0, baseSegments[index] ?? 0];

		if (left !== right) {
			verdict = left > right;
			break;
		}
	}

	return verdict;
};
