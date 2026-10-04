import { dirname, resolve } from 'node:path';
import { z } from 'zod';
import type { LoadedJestConfig } from '#src/coverage/common/types/LoadedJestConfig.ts';
import type { CoverageCollection } from '#src/coverage/selectCollectedFiles/common/types/CoverageCollection.ts';

/** Jest's own default when the key is absent. */
const defaultIgnorePatterns = ['/node_modules/'];

// Every field degrades to absent rather than failing the read: a shape the
// engine does not recognise is one it must not reason from, and `undefined`
// already means "assume the file is collected" to every caller downstream.
const JestConfigShape = z.looseObject({
	rootDir: z.string().optional().catch(undefined),
	collectCoverageFrom: z.array(z.string()).optional().catch(undefined),
	coveragePathIgnorePatterns: z.array(z.string()).optional().catch(undefined),
});

interface Params {
	loaded: LoadedJestConfig | undefined;
}

/** Undefined is the safe answer: every caller reads it as "assume the file is collected". */
export const readCoverageCollection = ({ loaded }: Params): CoverageCollection | undefined => {
	if (loaded === undefined) {
		return undefined;
	}

	const parsed = JestConfigShape.safeParse(loaded.config);

	if (!parsed.success) {
		return undefined;
	}

	// Jest resolves rootDir against the directory holding the config, and
	// defaults it to that directory.
	const configDir = dirname(loaded.configPath);

	return {
		rootDir: parsed.data.rootDir === undefined ? configDir : resolve(configDir, parsed.data.rootDir),
		collectCoverageFrom: parsed.data.collectCoverageFrom,
		coveragePathIgnorePatterns: parsed.data.coveragePathIgnorePatterns ?? defaultIgnorePatterns,
	};
};
