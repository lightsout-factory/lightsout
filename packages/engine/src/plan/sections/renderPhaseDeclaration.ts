import { buildModeBulletLabels } from '#src/plan/common/constants/buildModeBulletLabels.ts';
import type { PhaseDeclaration } from '#src/plan/common/types/PhaseDeclaration.ts';
import { planSentinelTokens } from '#src/plan/internal/common/constants/planSentinelTokens.ts';

interface Params {
	declaration: PhaseDeclaration;
}

const [nothingToDeclare] = planSentinelTokens;

const bullet = ({ label, values }: { label: string; values: string[] }) =>
	`- **${label}:** ${values.length === 0 ? nothingToDeclare : values.map((value) => `\`${value}\``).join(', ')}`;

/**
 * The exact inverse of the block half of `parsePhaseDeclarations`. Optional
 * bullets are written only when the record backs them: a bullet the phase file
 * does not back is the disagreement the consistency check reports. A
 * `buildModeConflict` is never rendered, because the mechanical repair resolves
 * it from the phase file before any block is written.
 */
export const renderPhaseDeclaration = ({ declaration }: Params): string => {
	const bullets = [
		bullet({ label: 'Creates', values: declaration.creates }),
		bullet({ label: 'Exports', values: declaration.exports }),
		bullet({ label: 'Scripts', values: declaration.scripts }),
		...(declaration.fileBudget === undefined ? [] : [`- **File budget:** ${declaration.fileBudget}`]),
		...(declaration.buildMode === undefined ? [] : [`- **${buildModeBulletLabels[declaration.buildMode]}:** yes`]),
	];

	return `### Phase ${declaration.number} — \`${declaration.file}\`\n\n${bullets.join('\n')}`;
};
