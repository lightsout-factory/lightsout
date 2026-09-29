import { FixtureSide } from '#src/contracts/views/FixtureSide.ts';
import type { StandardsPackBundle } from '#src/contracts/views/StandardsPackBundle.ts';
import { listStandardsPackBundles } from '#src/views/internal/listStandardsPackBundles.ts';
import { StandardsPackNotFoundError } from '#src/views/StandardsPackNotFoundError.ts';

/** Pass before fail, the order a rule's proof reads in — never the alphabet, which would put the counter-example first. */
const fixtureSideOrder = [FixtureSide.Pass, FixtureSide.Fail];

/**
 * `assets/default-pack.json` is committed and compared byte for byte in CI, so
 * its order must be decided where the bundle is produced, not left to the filesystem.
 */
const sortBundle = ({ bundle }: { bundle: StandardsPackBundle }) => ({
	...bundle,
	documents: [...bundle.documents].sort((left, right) => left.path.localeCompare(right.path)),
	rules: [...bundle.rules]
		.sort((left, right) => left.id.localeCompare(right.id))
		.map((rule) => ({
			...rule,
			fixtures: [...rule.fixtures].sort(
				(left, right) => fixtureSideOrder.indexOf(left.side) - fixtureSideOrder.indexOf(right.side) || left.path.localeCompare(right.path),
			),
		})),
});

interface Params {
	cwd: string;
	name: string;
}

/**
 * @param name - the pack's `name` from its lightsout-standards.json, as the URL carried it
 * @throws {StandardsPackNotFoundError} When no pack this repo loads answers to the name.
 */
export const getStandardsPackBundle = async ({ cwd, name }: Params): Promise<StandardsPackBundle> => {
	const bundles = await listStandardsPackBundles({ cwd });
	const bundle = bundles.find((entry) => entry.name === name);

	if (bundle === undefined) {
		throw new StandardsPackNotFoundError({ name });
	}

	return sortBundle({ bundle });
};
