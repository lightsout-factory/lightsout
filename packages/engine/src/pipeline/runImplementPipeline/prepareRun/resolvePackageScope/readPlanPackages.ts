interface Params {
	planContent: string;
}

const unquote = (value: string) => value.trim().replace(/^['"]|['"]$/g, '');

const collectBlockItems = ({ lines, keyIndex }: { lines: string[]; keyIndex: number }) => {
	const items: string[] = [];

	for (let index = keyIndex + 1; index < lines.length; index += 1) {
		const entry = lines[index]?.trim().match(/^-\s+(.+)$/);

		if (!entry?.[1]) {
			break;
		}

		items.push(unquote(entry[1]));
	}

	return items;
};

/**
 * Dependency-free, so only the inline form (`packages: [a, b]`) and the
 * block-list form (`- a` lines) are read. An empty list answers undefined.
 */
export const readPlanPackages = ({ planContent }: Params): string[] | undefined => {
	const frontMatter = planContent.match(/^---\r?\n([\s\S]*?)\r?\n---/)?.[1];

	if (!frontMatter) {
		return undefined;
	}

	const lines = frontMatter.split(/\r?\n/);
	const keyIndex = lines.findIndex((line) => /^packages:/.test(line.trim()));
	const keyLine = lines[keyIndex]?.trim();

	if (keyIndex === -1 || keyLine === undefined) {
		return undefined;
	}

	const inline = keyLine.match(/^packages:\s*\[(.*)\]\s*$/);
	const items = inline?.[1] === undefined ? collectBlockItems({ lines, keyIndex }) : inline[1].split(',').map(unquote).filter(Boolean);

	return items.length > 0 ? items : undefined;
};
