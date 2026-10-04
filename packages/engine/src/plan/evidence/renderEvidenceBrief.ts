import type { SourceEvidenceEntry } from '#src/contracts/plan/evidence/SourceEvidenceEntry.ts';
import type { SourceEvidenceIndex } from '#src/contracts/plan/evidence/SourceEvidenceIndex.ts';
import { SourceEvidenceKind } from '#src/contracts/plan/evidence/SourceEvidenceKind.ts';
import { wholeFileEvidenceLimit } from '#src/plan/evidence/common/constants/wholeFileEvidenceLimit.ts';

interface Params {
	index: SourceEvidenceIndex;
	/** In the order they should appear. */
	paths: string[];
}

/**
 * Longer than any backtick run inside, or a fenced example in a docblock would
 * close the block and spill the rest of the file into the prompt as instructions.
 */
const fenceFor = ({ text }: { text: string }) => {
	const longestRun = [...text.matchAll(/`+/g)].reduce((longest, match) => Math.max(longest, match[0].length), 0);

	return '`'.repeat(Math.max(3, longestRun + 1));
};

const fenced = ({ text }: { text: string }) => {
	const fence = fenceFor({ text });

	return `${fence}\n${text.endsWith('\n') ? text : `${text}\n`}${fence}`;
};

const roleLines = ({ roles }: { roles: string[] }) => (roles.length === 0 ? ['The facts recorded no role for this file.'] : roles.map((role) => `- ${role}`));

const renderBlock = ({ path, entry }: { path: string; entry: SourceEvidenceEntry | undefined }) => {
	const lines = [`### \`${path}\``, ''];

	if (entry === undefined) {
		lines.push('No evidence was collected for this path. Open the file yourself for anything you need from it.');
	} else {
		lines.push(...roleLines({ roles: entry.roles }), '');

		if (entry.kind === SourceEvidenceKind.Missing) {
			lines.push('The facts named this path and nothing was on disk at it when the evidence was collected.');
		} else {
			if (entry.kind === SourceEvidenceKind.Definitions) {
				lines.push(
					`This file is ${entry.bytes} bytes, past the ${wholeFileEvidenceLimit.toLocaleString('en-US')}-byte whole-file limit, so only these definitions are shown: ${entry.definitions.join(', ')}. Everything else the file holds is still there — open it for anything the definitions below do not answer.`,
					'',
				);
			}

			lines.push(fenced({ text: entry.text }));
		}
	}

	return lines.join('\n');
};

/**
 * No trailing newline: the caller owns how the section joins the text around it.
 *
 * Each kind of absence is worded differently on purpose, so a gap in the brief
 * is never read as a gap in the file.
 *
 * An empty `paths` list renders the empty string: an empty heading would read as
 * "there is no evidence for any of this", not "this spawn needs none".
 */
export const renderEvidenceBrief = ({ index, paths }: Params): string => {
	if (paths.length === 0) {
		return '';
	}

	const byPath = new Map(index.entries.map((entry) => [entry.path, entry]));
	const preamble = [
		'## Source Evidence',
		'',
		'The engine read these files once for this draft, from the paths the verified facts recorded. Start here rather than re-reading them. You still have file tools: open anything this section does not answer, and stop the draft rather than guessing when what you find and what the facts say cannot be reconciled.',
	];
	const blocks = paths.map((path) => renderBlock({ path, entry: byPath.get(path) }));

	return [...preamble, '', blocks.join('\n\n')].join('\n');
};
