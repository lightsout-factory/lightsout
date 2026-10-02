import type { FileTextInput } from '@lightsout/standards-contracts';
import { StandardsInputKind } from '@lightsout/standards-contracts';

interface Params extends Partial<Omit<FileTextInput, 'kind' | 'contents'>> {
	contents?: Array<[string, string]>;
}

/**
 * `files` and `source` default to the paths in `contents`. A file listed but
 * absent from `contents` — what a rule about unreadable files needs — is
 * expressed by passing `files` explicitly.
 */
export const setupFileTextInput = ({ contents = [], ...overrides }: Params = {}): FileTextInput => {
	const paths = contents.map(([path]) => path);

	return {
		kind: StandardsInputKind.FileText,
		cwd: '/repo',
		source: paths,
		tests: [],
		files: paths,
		referenceFiles: [],
		standardsLibraries: [],
		contents: new Map(contents),
		...overrides,
	};
};
