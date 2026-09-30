interface Params {
	/** A rule.md requires entry: a short rule id, or a full `<library>/<rule-id>` name. */
	entry: string;
	/** The requiring rule's own library, which a short id refers to. */
	library: string;
}

/**
 * Rule ids never hold a slash, so whatever precedes the last one is the
 * library name.
 *
 * @returns The name of the library the entry refers to.
 */
export const libraryOfRequirement = ({ entry, library }: Params): string => {
	const slash = entry.lastIndexOf('/');

	return slash === -1 ? library : entry.slice(0, slash);
};
