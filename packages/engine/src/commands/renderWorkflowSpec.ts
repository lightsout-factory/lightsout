import { getCommandCatalogEntry } from '#src/commands/getCommandCatalogEntry.ts';
import { CommandActor } from '#src/contracts/commands/CommandActor.ts';
import type { CommandStep } from '#src/contracts/commands/CommandStep.ts';

const theme = { from: '#35d6e8', to: '#b06bf5' };

/** `tone` names a gradient endpoint: the engine's own steps take the far end, a person's or an agent's the near one. */
const renderCard = ({ step }: { step: CommandStep }) => ({
	title: step.title,
	tag: { label: step.actor, tone: step.actor === CommandActor.Engine ? 'to' : 'from' },
	bullets: step.bullets,
	...(step.note === undefined ? {} : { note: step.note }),
	...(step.savedLabel === undefined ? {} : { savedLabel: step.savedLabel }),
	saved: step.saved,
});

interface Params {
	/** The catalog id of a command that has a graphic — `plan`, `implement` or `refactor`. */
	id: string;
}

/**
 * The shape is the one `.claude/skills/flow-graphic/reference/spec.md`
 * documents, which is what `build_graphic.py` reads. Rendered from the catalog
 * so a step's wording cannot drift between the README's graphic and the
 * command's own page.
 *
 * @throws {Error} When no command answers to the id, or the command has no graphic.
 */
export const renderWorkflowSpec = ({ id }: Params): unknown => {
	const entry = getCommandCatalogEntry({ id });

	if (entry?.graphic === undefined) {
		throw new Error(`no workflow graphic for '${id}' — the catalog gives one to plan, implement and refactor only`);
	}

	return {
		title: entry.graphic.title,
		subtitle: entry.graphic.subtitle,
		columns: entry.graphic.columns,
		savedLabel: 'SAVED TO DISK',
		theme,
		banner: entry.graphic.banner,
		cards: entry.steps.map((step) => renderCard({ step })),
	};
};
