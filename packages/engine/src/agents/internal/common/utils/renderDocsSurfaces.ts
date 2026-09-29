import type { ConfigDocs } from '#src/contracts/ConfigDocs.ts';

interface Params {
	/** The repository's declared documentation surfaces, in the order the config wrote them. */
	docs: ConfigDocs;
}

/**
 * Shared by the plan writer's brief, the repairer's brief and the documentation
 * checker's role prompt so the rendering cannot drift. Each caller supplies its
 * own heading and prose, because what each agent does with the list differs.
 */
export const renderDocsSurfaces = ({ docs }: Params): string => docs.map(({ path, covers }) => `- \`${path}\` — ${covers}`).join('\n');
