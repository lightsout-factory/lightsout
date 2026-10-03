import type { StandardsCheckModule } from '@lightsout/standards-contracts';
import { buildFileExportCheck } from '#common/checks/buildFileExportCheck.ts';
import { collapseCasing } from '#common/naming/collapseCasing.ts';
import { getExportName } from '#common/naming/getExportName.ts';

/** A dotted name (`events.service`, `user.model`) matches on the whole name or on the part before any of its dots. */
const getDotPrefixes = ({ name }: { name: string }) => name.split('.').map((_, index, segments) => segments.slice(0, index + 1).join('.'));

const isNameMatch = ({ fileName, exportName }: { fileName: string; exportName: string }) =>
	getDotPrefixes({ name: fileName }).some((candidate) => collapseCasing({ name: candidate }) === collapseCasing({ name: exportName }));

/**
 * Silent on a file with two or more exports: the one-export-per-file rule owns
 * it. Casing is ignored, because which convention a directory follows would
 * need the directory's history rather than the file in hand.
 */
export const check: StandardsCheckModule = buildFileExportCheck({
	rule: 'filename-mismatch',
	detail: ({ file, exports }) => {
		const [primary] = exports;
		const fileName = getExportName({ path: file });

		return primary === undefined || exports.length > 1 || isNameMatch({ fileName, exportName: primary.name })
			? undefined
			: `file '${fileName}' exports '${primary.name}'`;
	},
	guidance: 'The filename should match the export it holds.',
});
