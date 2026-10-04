import type { StandardsCheckModule } from '@lightsout/standards-contracts';
import { buildFileExportCheck } from '#common/checks/buildFileExportCheck.ts';
import type { FileExport } from '#common/types/FileExport.ts';

/** A `const` object and the type derived from it share one name, so they are one thing under two declarations. */
const isNamedConstant = ({ exports }: { exports: FileExport[] }) => {
	const [first, second] = exports;

	return (
		exports.length === 2 &&
		first?.name === second?.name &&
		exports.some(({ keyword }) => keyword === 'const') &&
		exports.some(({ keyword }) => keyword === 'type')
	);
};

/** The names an alias lists between its `=` and the next export, which is where a union written one member per line ends. */
const readUnionMembers = ({ text, alias }: { text: string; alias: FileExport }) => {
	const [declaration = ''] = text.slice(text.indexOf(alias.line)).split(/\nexport\s/);

	return declaration
		.slice(declaration.indexOf('=') + 1)
		.split('|')
		.map((member) => member.replace(';', '').trim())
		.filter((member) => member !== '');
};

/**
 * Member interfaces plus the one alias that is a union of them, and nothing
 * else in the file. An alias that leaves an interface out is a second export
 * sharing the file, not that interface's union.
 */
const isUnionFamily = ({ text, exports }: { text: string; exports: FileExport[] }) => {
	const interfaces = exports.filter((entry) => entry.keyword === 'interface');
	const [alias, ...otherAliases] = exports.filter((entry) => entry.keyword === 'type');

	if (alias === undefined || otherAliases.length > 0 || interfaces.length === 0 || interfaces.length + 1 !== exports.length) {
		return false;
	}

	const members = readUnionMembers({ text, alias });

	return members.length > 1 && interfaces.every(({ name }) => members.includes(name));
};

export const check: StandardsCheckModule = buildFileExportCheck({
	rule: 'multi-export',
	detail: ({ text, exports }) =>
		exports.length < 2 || isNamedConstant({ exports }) || isUnionFamily({ text, exports })
			? undefined
			: `${exports.length} exports (${exports.map(({ name }) => name).join(', ')})`,
	guidance: 'Give each export its own file, named after it, or stop exporting what only this file uses.',
});
