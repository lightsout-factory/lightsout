import type { StandardsCheckModule } from '@lightsout/standards-contracts';
import { buildFileExportCheck } from '#common/checks/buildFileExportCheck.ts';
import { getExportName } from '#common/naming/getExportName.ts';
import type { FileExport } from '#common/types/FileExport.ts';

/**
 * The one name a file's exports give it: the export itself, the name a
 * constant object shares with its derived type, or the alias of a union that
 * sits with its member interfaces. Any other mix has no single name, and the
 * one-export-per-file rule owns that file.
 */
const getExpectedName = ({ exports }: { exports: FileExport[] }) => {
	const names = new Set(exports.map(({ name }) => name));
	const aliases = exports.filter(({ keyword }) => keyword === 'type');
	const [alias] = aliases;

	if (names.size === 1) {
		return exports[0]?.name;
	}

	return aliases.length === 1 && exports.every((entry) => entry === alias || entry.keyword === 'interface') ? alias?.name : undefined;
};

export const check: StandardsCheckModule = buildFileExportCheck({
	rule: 'filename-mismatch',
	detail: ({ file, exports }) => {
		const expectedName = getExpectedName({ exports });
		const fileName = getExportName({ path: file });

		return expectedName === undefined || fileName === expectedName ? undefined : `file '${fileName}' exports '${expectedName}'`;
	},
	guidance: 'Name the file exactly as its export, casing included.',
});
