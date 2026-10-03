import type { RawStandardsFinding, StandardsCheckModule } from '@lightsout/standards-contracts';
import { readTestFiles } from '#common/checkInput/readTestFiles.ts';
import { buildLineSites } from '#common/findings/buildLineSites.ts';
import { buildRawFinding } from '#common/findings/buildRawFinding.ts';
import { readCallBlocks } from '#common/parsing/readCallBlocks.ts';

/** The manual cleanup a Jest config's `clearMocks`/`restoreMocks` already performs. */
const manualCleanup = /jest\.(?:clearAllMocks|resetAllMocks|restoreAllMocks)\s*\(|\.mock(?:Clear|Reset)\s*\(/;

/**
 * Hook bodies only, which is what makes the rule's own fallback structural: the
 * same `.mockReset()` at the top of a `setup()` factory is the prose's advice
 * for a package that cannot adopt the config, and never reaches here. One
 * finding per file, listing every hook, since the fix is one config change.
 */
const buildFileFindings = ({ file, text }: { file: string; text: string }): RawStandardsFinding[] => {
	const hooks = readCallBlocks({ text, callees: ['beforeEach', 'beforeAll', 'afterEach', 'afterAll'] }).filter((block) => manualCleanup.test(block.body));

	return hooks.length === 0
		? []
		: [
				buildRawFinding({
					rule: 'test-manual-mock-cleanup',
					files: buildLineSites({ file, spans: hooks }),
					detail: `${hooks.map((block) => `${block.callee} at line ${block.startLine}`).join(', ')} clears mocks by hand`,
					guidance: "Mock cleanup belongs in the package's Jest config (`clearMocks`, `restoreMocks`), not in a per-file hook.",
				}),
			];
};

export const check: StandardsCheckModule = {
	inputKinds: ['test-file'],
	run: ({ inputs }): RawStandardsFinding[] => readTestFiles({ input: inputs['test-file'] }).flatMap(buildFileFindings),
};
