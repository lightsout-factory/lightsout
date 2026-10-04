import type { ProseFile } from '#src/contracts/plan/ledger/ProseFile.ts';

interface Params {
	/** Undefined when the section is absent. */
	sectionLines: string[] | undefined;
	/** 1-based line number of the section's first line in the plan file. */
	firstLine: number;
}

const splitAtSpan = ({ line }: { line: string }) => {
	const span = /`([^`]+)`/.exec(line);

	return span === null ? undefined : { path: span[1].trim(), rest: line.slice(span.index + span[0].length) };
};

/**
 * One `-` bullet per file: the path in a backticked span, then a dash and the
 * reason no test states that file's behaviour. A bullet with no span names
 * nothing and is ignored. One that names a path but states no reason is
 * malformed: the exemption exists because of its reason.
 */
export const parseProseFiles = ({ sectionLines, firstLine }: Params): { files: ProseFile[]; malformedLines: number[] } => {
	const files: ProseFile[] = [];
	const malformedLines: number[] = [];

	for (const [index, line] of (sectionLines ?? []).entries()) {
		if (!/^\s*-\s+/.test(line)) {
			continue;
		}

		const named = splitAtSpan({ line });

		if (named === undefined) {
			continue;
		}

		const reason = /^\s*[—–-]\s*(\S.*?)\s*$/.exec(named.rest)?.[1];

		if (named.path === '' || reason === undefined) {
			malformedLines.push(firstLine + index);

			continue;
		}

		files.push({ path: named.path, reason, line: firstLine + index });
	}

	return { files, malformedLines };
};
