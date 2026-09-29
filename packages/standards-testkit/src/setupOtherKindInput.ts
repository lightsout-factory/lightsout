import type { StandardsCheckInput } from '@lightsout/standards-contracts';
import { setupCloneSpansInput } from '#src/setupCloneSpansInput.ts';

/**
 * An input of a kind the rule under test did not declare, for proving the
 * narrowing guard a real run never reaches.
 */
export const setupOtherKindInput = (): StandardsCheckInput => setupCloneSpansInput({ source: ['src/subject.ts'] });
