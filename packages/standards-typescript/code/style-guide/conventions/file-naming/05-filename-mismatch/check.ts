import type { StandardsCheckModule } from '@lightsout/standards-contracts';
import { readManifestDependencies } from '../../../../../common/checkInput/readManifestDependencies.ts';
import { buildFileExportCheck } from '../../../../../common/checks/buildFileExportCheck.ts';
import { getFrameworkCarveOuts } from '../../../../../common/frameworks/getFrameworkCarveOuts.ts';
import { getPathCarveOut } from '../../../../../common/frameworks/getPathCarveOut.ts';
import { isFrameworkNamedFile } from '../../../../../common/frameworks/isFrameworkNamedFile.ts';
import { collapseCasing } from '../../../../../common/naming/collapseCasing.ts';
import { getExportName } from '../../../../../common/naming/getExportName.ts';

/**
 * A framework dot-suffix (`.service`, `.model`, `.dto`, `.entity`) is the
 * framework naming the file, which overrides casing entirely, so a match on the
 * part before the suffix counts.
 */
const getDotPrefixes = ({ name }: { name: string }) => name.split('.').map((_, index, segments) => segments.slice(0, index + 1).join('.'));

const isNameMatch = ({ fileName, exportName }: { fileName: string; exportName: string }) =>
	getDotPrefixes({ name: fileName }).some((candidate) => collapseCasing({ name: candidate }) === collapseCasing({ name: exportName }));

/**
 * Silent on a file with two or more exports: the one-export-per-file rule owns
 * it. Casing is ignored, because which convention a directory follows would
 * need the directory's history rather than the file in hand.
 *
 * Silent too on a file whose name a framework chose — a router file such as
 * `runs.$runId.tsx` exporting `Route`, or `src/router.tsx` exporting
 * `getRouter` — since no author is allowed to rename it.
 */
export const check: StandardsCheckModule = buildFileExportCheck({
	rule: 'filename-mismatch',
	getExempt: ({ files, contents }) => {
		const carveOuts = getFrameworkCarveOuts({ dependencies: readManifestDependencies({ contents }) });

		return new Set(files.filter((file) => isFrameworkNamedFile({ path: file, carveOut: getPathCarveOut({ carveOuts, path: file }) })));
	},
	detail: ({ file, exports }) => {
		const [primary] = exports;
		const fileName = getExportName({ path: file });

		return primary === undefined || exports.length > 1 || isNameMatch({ fileName, exportName: primary.name })
			? undefined
			: `file '${fileName}' exports '${primary.name}'`;
	},
	guidance: 'The filename should match the export it holds.',
});
