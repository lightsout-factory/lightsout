import type { RawStandardsFinding, StandardsCheckModule } from '@lightsout/standards-contracts';
import { readPathLists } from '#common/checkInput/readPathLists.ts';
import { buildRawFinding } from '#common/findings/buildRawFinding.ts';
import { getFrameworkCarveOuts } from '#common/frameworks/getFrameworkCarveOuts.ts';
import { getPathCarveOut } from '#common/frameworks/getPathCarveOut.ts';
import { getDirectory } from '#common/paths/getDirectory.ts';
import { getTestSubject } from '#common/paths/getTestSubject.ts';
import { getTestSubjectName } from '#common/paths/getTestSubjectName.ts';
import { isUnderSrc } from '#common/paths/isUnderSrc.ts';
import type { FrameworkCarveOut } from '#common/types/FrameworkCarveOut.ts';

/**
 * The separate-directory names the rule refuses for a unit test. Outside `src/`
 * these very names are the sanctioned test-support locations, which is why the
 * rule is anchored to `src/`.
 */
const testDirectories = new Set(['__tests__', 'tests', 'test']);

const isSeparated = ({ test }: { test: string }) =>
	getDirectory({ path: test })
		.split('/')
		.some((segment) => testDirectories.has(segment));

// A test filed into a separate directory is reported for the directory alone:
// it has no subject beside it by construction, and moving it is the one fix.
//
// The carve-out is looked up once and carried to both the lookup and the
// detail, since a finding that named a subject the lookup never searched for
// would send an author after a file the rule was not asking about.
const placementFindings = ({ test, files, carveOuts }: { test: string; files: Set<string>; carveOuts: FrameworkCarveOut[] }) => {
	const carveOut = getPathCarveOut({ carveOuts, path: test });
	const separated = isSeparated({ test });
	const orphaned = !separated && getTestSubject({ test, files, carveOut }) === undefined;

	return separated || orphaned
		? [
				buildRawFinding({
					rule: 'test-beside-subject',
					files: [{ path: test }],
					detail: separated
						? `a unit test in ${getDirectory({ path: test })}`
						: `no source file named '${getTestSubjectName({ test, carveOut })}' in ${getDirectory({ path: test })}`,
					guidance: separated
						? 'A unit test sits beside the file it tests — move it next to its subject rather than into a separate directory.'
						: 'The first name segment must name a real source file in the same folder; a scenario suite qualifies it as `<File>.<scenario>.unit.test.ts` with a camelCase qualifier.',
				}),
			]
		: [];
};

export const check: StandardsCheckModule = {
	inputKind: 'file-list',
	// Anchored to `src/`: a package's own `tests/` directory is a sanctioned
	// test-support location whose files name no subject beside them.
	run: ({ input }): RawStandardsFinding[] => {
		const { files, tests } = readPathLists({ input });
		const carveOuts = getFrameworkCarveOuts({ dependencies: input.kind === 'file-list' ? input.dependencies : new Map<string, string[]>() });
		const fileSet = new Set(files);

		return tests.filter((test) => isUnderSrc({ path: test })).flatMap((test) => placementFindings({ test, files: fileSet, carveOuts }));
	},
};
