import type { FileListInput, StandardsCheckInput } from '@lightsout/standards-contracts';
import { StandardsInputKind } from '@lightsout/standards-contracts';

interface Params extends Partial<Omit<FileListInput, 'kind' | 'dependencies'>> {
	dependencies?: Array<[string, string[]]>;
}

/**
 * Give `files` and it is taken as the source; give `source` and `tests` and
 * `files` becomes both together.
 *
 * @param dependencies - declared dependency names per package directory, as pairs — `'.'` is the repo root
 */
export const setupFileListInput = ({ files, source, tests = [], dependencies = [], ...overrides }: Params = {}): StandardsCheckInput => ({
	kind: StandardsInputKind.FileList,
	cwd: '/repo',
	source: source ?? files ?? [],
	tests,
	files: files ?? [...(source ?? []), ...tests],
	referenceFiles: [],
	dependencies: new Map(dependencies),
	standardsPacks: [],
	...overrides,
});
