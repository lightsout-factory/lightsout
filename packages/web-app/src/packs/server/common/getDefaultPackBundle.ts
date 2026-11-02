import { StandardsPackBundle } from '@lightsout/engine';
import bundle from '#assets/default-pack.json';

/** Parsed once: the file is bundled data that cannot change while the app runs. */
let parsed: StandardsPackBundle | undefined;

/**
 * Written by `scripts/buildDefaultPackView.mjs`. The authored pack rather than
 * the copy `plugin/standards/` ships, because the bundler strips the fixtures a
 * rule page shows.
 */
export const getDefaultPackBundle = (): StandardsPackBundle => {
	if (parsed === undefined) {
		parsed = StandardsPackBundle.parse(bundle);
	}

	return parsed;
};
