import { parsePlan } from '#src/plan/parsePlan/parsePlan.ts';

interface Params {
	/** The `## Phases` table rows, one per line, below the header and separator. */
	rows?: string;
	/** The `## Phase Declarations` section's body. */
	declarations?: string;
}

/** An overview carrying the given `## Phases` table rows and `## Phase Declarations` blocks, parsed as the lint parses it. */
export const setupPhaseDeclarationsOverview = ({ rows = '', declarations = '' }: Params = {}) => {
	const content = `# Demo — Overview

## Phases

| # | File | Scope | Creates | Touches |
|---|------|-------|---------|---------|
${rows}

## Phase Declarations

${declarations}

## Cross-Phase Dependencies

- None.
`;

	return { plan: parsePlan({ content, base: 'overview.md' }) };
};
