import type { FileListInput } from '@lightsout/standards-contracts';

interface Params {
	/** The file-list input the engine built for this run, when the rule declared that kind. */
	input: FileListInput | undefined;
}

/**
 * A missing input yields empty lists: a rule that declared the kind is always
 * handed it, so refusing loudly would describe a situation that cannot arise.
 */
export const readPathLists = ({ input }: Params): { files: string[]; tests: string[]; standardsLibraries: string[] } =>
	input === undefined
		? { files: [], tests: [], standardsLibraries: [] }
		: { files: input.files, tests: input.tests, standardsLibraries: input.standardsLibraries };
