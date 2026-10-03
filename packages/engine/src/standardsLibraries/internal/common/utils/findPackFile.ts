import type { LoadedStandardsLibrary } from '#src/standardsLibraries/common/types/LoadedStandardsLibrary.ts';
import type { LoadedStandardsPackFile } from '#src/standardsLibraries/common/types/LoadedStandardsPackFile.ts';
import { splitPackAddress } from '#src/standardsLibraries/internal/common/utils/splitPackAddress.ts';

interface Params {
	/** `<library>/<file-stem>`. */
	address: string;
	/** Every library the repo registered. */
	libraries: LoadedStandardsLibrary[];
	/** The addresses being expanded above this one, outermost first; empty for a pack asked for by name. */
	chain: string[];
}

/**
 * Every problem names the pack being expanded — or, for an included pack, the pack including it and the entry.
 *
 * @throws {Error} When the address is malformed, names an unregistered library or no pack, or closes an include cycle.
 */
export const findPackFile = ({ address, libraries, chain }: Params): { library: LoadedStandardsLibrary; packFile: LoadedStandardsPackFile } => {
	const includedBy = chain.at(-1);
	const fail = ({ reason }: { reason: string }) =>
		new Error(includedBy === undefined ? `pack ${address}: ${reason}` : `pack ${includedBy}: include.packs entry "${address}" ${reason}`);
	const cycleStart = chain.indexOf(address);

	if (cycleStart !== -1) {
		throw fail({ reason: `closes an include cycle: ${[...chain.slice(cycleStart), address].join(' → ')}` });
	}

	const parts = splitPackAddress({ address });
	const library = libraries.find((candidate) => candidate.name === parts?.libraryName);

	if (parts === undefined || library === undefined) {
		throw fail({
			reason: parts === undefined ? 'is not an address of the form <library>/<name>' : `names library "${parts.libraryName}", which is not registered`,
		});
	}

	const packFile = library.packs.find((candidate) => candidate.name === parts.path);

	if (packFile === undefined) {
		throw fail({ reason: 'names no pack' });
	}

	return { library, packFile };
};
