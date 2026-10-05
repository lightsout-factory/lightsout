import type { CallBlock } from '#common/types/CallBlock.ts';

/** One `jest.mock()` factory whose wrapper loses arguments, and why. */
export interface UntypedWrapper {
	block: CallBlock;
	reasons: string[];
}
