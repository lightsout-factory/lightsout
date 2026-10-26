import type { StandardsInputKind } from '@lightsout/standards-contracts';
import { typescriptInputKinds } from '#src/standardsCheck/common/constants/typescriptInputKinds.ts';

interface Params {
	/** The kinds the check cannot run without. */
	inputKinds: StandardsInputKind[];
	/** The kinds the check uses only when they can be built. */
	optionalInputKinds?: StandardsInputKind[];
	/** Whether a TypeScript is at hand to parse with. */
	hasTypescript: boolean;
}

/**
 * The kinds to build for one check: all it requires, and each optional kind
 * this install can build. A required kind that needs a missing TypeScript is
 * the caller's to report; an optional one is just left out.
 */
export const selectInputKinds = ({ inputKinds, optionalInputKinds = [], hasTypescript }: Params): StandardsInputKind[] => [
	...inputKinds,
	...optionalInputKinds.filter((kind) => hasTypescript || !typescriptInputKinds.has(kind)),
];
