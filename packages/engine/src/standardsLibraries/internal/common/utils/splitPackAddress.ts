interface Params {
	/** A pack, topic or rule address of the form `<library>/<rest>`. */
	address: string;
}

/** Split at the first slash, so a topic path keeps its own slashes; undefined when the address has none. */
export const splitPackAddress = ({ address }: Params): { libraryName: string; path: string } | undefined => {
	const slash = address.indexOf('/');

	return slash === -1 ? undefined : { libraryName: address.slice(0, slash), path: address.slice(slash + 1) };
};
