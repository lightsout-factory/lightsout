/**
 * The `##` sections of a plan file the ENGINE composes from a record rather than
 * an author writing them.
 *
 * `## Cross-Phase Dependencies` is deliberately absent: it is authored prose,
 * and a wrong entry here would drop design text out of a design hash.
 */
export const generatedPlanRegions = {
	decisionLog: 'Decision Log',
	globalConstraints: 'Global Constraints',
	phases: 'Phases',
	phaseDeclarations: 'Phase Declarations',
} as const;
