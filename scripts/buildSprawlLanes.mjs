/** Measured on the lane's whole tree, not on the bars the chart happens to draw, because the payoff counter reports it. */
const countOverCap = ({ files, caps }) => {
	let over = 0;

	for (const [path, lines] of files) {
		if (lines > (path.endsWith('.tsx') ? caps.tsxFile : caps.file)) {
			over += 1;
		}
	}

	return over;
};

const buildFolderSet = ({ files }) => {
	const folders = new Set();

	for (const path of files.keys()) {
		for (let cut = path.lastIndexOf('/'); cut > 0; cut = path.lastIndexOf('/', cut - 1)) {
			folders.add(path.slice(0, cut));
		}
	}

	return folders;
};

/**
 * A graduation is a file leaving and a folder of its own name arriving with an
 * `index.ts` inside it, in the same commit. The folder has to be NEW, or an
 * ordinary deletion would be counted as a split nobody made.
 */
const findGraduations = ({ previous, current, previousFolders, currentFolders }) => {
	const graduations = [];

	for (const path of previous.files.keys()) {
		const stem = path.replace(/\.tsx?$/, '');
		const prefix = `${stem}/`;
		const hasIndex = current.files.has(`${prefix}index.ts`) || current.files.has(`${prefix}index.tsx`);

		if (!current.files.has(path) && hasIndex && !previousFolders.has(stem) && currentFolders.has(stem)) {
			graduations.push([path, prefix]);
		}
	}

	return graduations;
};

/**
 * Longest prefix first, so a split inside an already-undone folder lands in the
 * outer sum instead of being counted twice.
 */
const undoGraduations = ({ tree, substitutions }) => {
	const files = new Map(tree.files);
	const folders = new Map(tree.folders);
	const ordered = [...substitutions].sort(([, left], [, right]) => right.length - left.length);

	for (const [path, prefix] of ordered) {
		let lines = 0;

		for (const [candidate, count] of files) {
			if (candidate.startsWith(prefix)) {
				lines += count;
				files.delete(candidate);
			}
		}

		files.set(path, lines);

		for (const folder of folders.keys()) {
			if (folder === prefix.slice(0, -1) || folder.startsWith(prefix)) {
				folders.delete(folder);
			}
		}

		const parent = path.slice(0, path.lastIndexOf('/'));

		folders.set(parent, (folders.get(parent) ?? 0) + 1);
	}

	return { files, folders };
};

/**
 * The lanes differ by one variable: in "without", every graduation is undone.
 *
 * Consolidation is deliberately not undone: folder populations count direct
 * files only, as the census check does, so undoing a move would change no
 * number the chart draws.
 */
export const buildSprawlLanes = ({ trees, caps }) => {
	const withStates = [];
	const withoutStates = [];
	const substitutions = new Map();
	let previous = { files: new Map(), folders: new Map() };
	let previousFolders = new Set();

	for (const tree of trees) {
		const currentFolders = buildFolderSet({ files: tree.files });

		for (const [path, prefix] of findGraduations({ previous, current: tree, previousFolders, currentFolders })) {
			substitutions.set(path, prefix);
		}

		for (const [path, prefix] of substitutions) {
			// A deleted subtree is a deletion in both lanes, not a zero-line
			// phantom held at a path nobody has any more.
			if (!currentFolders.has(prefix.slice(0, -1))) {
				substitutions.delete(path);
			}
		}

		const without = undoGraduations({ tree, substitutions });

		withStates.push({ files: tree.files, folders: tree.folders, overCap: countOverCap({ files: tree.files, caps }) });
		withoutStates.push({ files: without.files, folders: without.folders, overCap: countOverCap({ files: without.files, caps }) });
		previous = tree;
		previousFolders = currentFolders;
	}

	return { withStates, withoutStates };
};
