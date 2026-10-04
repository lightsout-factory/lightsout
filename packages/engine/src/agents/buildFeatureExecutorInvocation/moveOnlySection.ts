import { listSection } from '#src/agents/common/listSection.ts';

interface Params {
	/** The plan's declared file moves. */
	fileMoves?: { from: string; to: string }[];
	/** The plan's declared folder moves, with no trailing `/`. */
	folderMoves?: { from: string; to: string }[];
}

/**
 * The standing brief stops at a source-file limit and says every test edit is
 * reviewed by an agent, and neither holds for this phase, so this section says
 * so plainly.
 */
export const moveOnlySection = ({ fileMoves = [], folderMoves = [] }: Params): string | undefined =>
	listSection({
		heading: 'Move-folders-and-files phase',
		intro: 'This phase only moves folders and files. These are its moves:',
		items: [...folderMoves.map(({ from, to }) => `- \`${from}/\` → \`${to}/\``), ...fileMoves.map(({ from, to }) => `- \`${from}\` → \`${to}\``)],
		rules: [
			'- Move each listed folder and file: its old path must be gone, and its files must arrive at the new path.',
			'- Move every file in full. A file left at a listed old path, or left behind in a listed folder, is refused by name.',
			'- A file that is not text, such as an image or another binary, may only be moved unchanged.',
			'- Update the paths that point at moved files, wherever they are written in the repository, and change nothing else.',
			"- Update a path where it is written: change the path text itself and keep every other character of the line as it was. A relative depth spelled as separate arguments, such as `path.join(__dirname, '..', 'x')`, cannot be updated in this mode; that change belongs in a standard phase.",
			'- Write no tests.',
			"- The standing brief's stop rule on the number of source files does not apply to this phase.",
			'- In `changedFiles`, report the files you edited, plus one entry per moved folder rather than every file the folder carried.',
			"- Before any gate runs, the engine pairs every removed file with an added file at its declared destination and refuses any file a declared move left at its old path. It also refuses any changed file that differs from the phase's starting commit in anything but the paths that point at moved files.",
			"- That move check runs in place of the agent test-change review the standing brief describes: no agent reviews this phase's edits.",
		],
	});
