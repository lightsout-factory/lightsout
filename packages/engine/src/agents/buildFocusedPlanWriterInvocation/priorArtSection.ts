import type { ExportCollision } from '#src/plan/evidence/common/types/ExportCollision.ts';

interface Params {
	/** The census results for the symbols this spawn will create; empty means the census found nothing. */
	collisions: ExportCollision[];
}

/** Every collision for a symbol goes on one line so a second one is never dropped. */
const renderCollision = ({ symbol, collidesWith }: ExportCollision) => {
	const existing = collidesWith.map((collision) => `\`${collision.name}\` in \`${collision.path}\``).join('; ');

	return `- \`${symbol}\` — already answered by: ${existing}`;
};

const renderFindings = ({ collisions }: { collisions: ExportCollision[] }) =>
	collisions.length === 0
		? 'The census compared every symbol your assignment names against the existing exports, and none of them collides with one.'
		: `The census matched these planned symbols against existing exports:\n\n${collisions.map(renderCollision).join('\n')}`;

/**
 * A clean census still renders, because it is the evidence a `## Prior Art` line
 * records. The caller omits the section when no census ran, so a spawn can tell
 * that apart from a census that found nothing.
 */
export const priorArtSection = ({ collisions }: Params): string =>
	`## Prior art census

${renderFindings({ collisions })}

A match is a name match and nothing more. It does not prove duplication, and a
clean result does not prove that the same functionality is absent under another
name — which is why the reuse judgment stays yours. For each match, state the
decision it implies: mirror the existing export, extend it, or say why it cannot
serve. A real collision is worth one targeted read of the colliding export
first. Do not re-run this comparison symbol by symbol; the engine already did,
and a planned symbol the census does not cover gets one targeted search. Record
what you concluded in the plan's \`## Prior Art\` section, one line per new
symbol.`;
