interface Params {
	bytes: number;
}

export const formatBytes = ({ bytes }: Params): string => {
	const kilobyte = 1024;
	let formatted = `${bytes} B`;

	if (bytes >= kilobyte * kilobyte) {
		formatted = `${(bytes / (kilobyte * kilobyte)).toFixed(1)} MB`;
	} else if (bytes >= kilobyte) {
		formatted = `${(bytes / kilobyte).toFixed(1)} KB`;
	}

	return formatted;
};
