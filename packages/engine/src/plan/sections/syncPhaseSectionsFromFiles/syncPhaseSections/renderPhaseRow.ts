import type { PhaseDeclaration } from '#src/common/types/PhaseDeclaration.ts';

interface Params {
	declaration: PhaseDeclaration;
}

const toCell = ({ text }: { text: string }) => text.trim().replaceAll('|', '\\|').replace(/\r?\n/g, '<br>');

/**
 * The exact inverse of the table half of `parsePhaseDeclarations`. An absent
 * count renders as an empty cell, which that parser reads as missing, so the
 * consistency check can still report it.
 */
export const renderPhaseRow = ({ declaration }: Params): string => {
	const cells = [
		String(declaration.number),
		`\`${declaration.file}\``,
		toCell({ text: declaration.scope }),
		declaration.createdCount === undefined ? '' : String(declaration.createdCount),
		declaration.touchedCount === undefined ? '' : String(declaration.touchedCount),
	];

	return `| ${cells.join(' | ')} |`;
};
