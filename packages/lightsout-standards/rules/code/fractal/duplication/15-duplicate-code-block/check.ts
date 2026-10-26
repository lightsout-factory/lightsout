import type { CloneSpan, RawStandardsFinding, StandardsCheckModule, SyntaxTreeInput } from '@lightsout/standards-contracts';
import type ts from 'typescript';
import { buildRawFinding } from '#common/findings/buildRawFinding.ts';
import { getSiteGroupKey } from '#common/findings/getSiteGroupKey.ts';
import { findForwardingLines } from './findForwardingLines.ts';

interface ClonedPair {
	files: RawStandardsFinding['files'];
	spans: number;
	longest: number;
}

const getSpanLines = ({ span }: { span: CloneSpan }) => Math.max(...span.files.map(({ startLine, endLine }) => endLine - startLine + 1));

interface FileView {
	forwarding: Set<number>;
	lines: string[];
}

const countTokens = ({ text, compiler }: { text: string; compiler: typeof ts }) => {
	const scanner = compiler.createScanner(compiler.ScriptTarget.Latest, true, compiler.LanguageVariant.Standard, text);
	let tokens = 0;

	while (scanner.scan() !== compiler.SyntaxKind.EndOfFileToken) {
		tokens += 1;
	}

	return tokens;
};

/** The share of a side's code, by token, that sits outside its forwarding members. */
const shareOutsideForwarding = ({ view, file, compiler }: { view: FileView; file: CloneSpan['files'][number]; compiler: typeof ts }) => {
	const lines = view.lines.slice(file.startLine - 1, file.endLine);
	const all = countTokens({ text: lines.join('\n'), compiler });
	const kept = countTokens({ text: lines.filter((_, index) => !view.forwarding.has(file.startLine + index)).join('\n'), compiler });

	return all === 0 ? 1 : kept / all;
};

/**
 * Members that only hold or forward to a collaborator repeat by design under
 * composition in place of `extends`, so they do not count toward a copy. The
 * span's own token count is scaled by the share of its code outside them, on
 * the side that keeps least, and the span is dropped when that falls below the
 * rule's floor. A span with no forwarding member keeps its whole count.
 */
const dropForwardingSpans = ({ spans, input, minTokens }: { spans: CloneSpan[]; input: SyntaxTreeInput; minTokens: number }) => {
	const views = new Map<string, FileView>();

	const viewOf = ({ path }: { path: string }) => {
		const tree = input.trees.get(path);
		const known = views.get(path);

		if (known !== undefined || tree === undefined) {
			return known;
		}

		const view = { forwarding: findForwardingLines({ sourceFile: tree, compiler: input.compiler }), lines: tree.text.split('\n') };

		views.set(path, view);

		return view;
	};

	return spans.filter((span) => {
		const shares = span.files.map((file) => {
			const view = viewOf({ path: file.path });

			return view === undefined ? 1 : shareOutsideForwarding({ view, file, compiler: input.compiler });
		});

		return span.tokens * Math.min(...shares) >= minTokens;
	});
};

const groupByPair = ({ spans }: { spans: CloneSpan[] }) => {
	const byPair = new Map<string, ClonedPair>();

	for (const span of spans) {
		const key = getSiteGroupKey({ files: span.files });
		const pair = byPair.get(key) ?? { files: [], spans: 0, longest: 0 };

		byPair.set(key, {
			files: [...pair.files, ...span.files],
			spans: pair.spans + 1,
			longest: Math.max(pair.longest, getSpanLines({ span })),
		});
	}

	return byPair;
};

export const check: StandardsCheckModule = {
	inputKinds: ['clone-spans'],
	// Without a TypeScript to parse with, no member is known to forward, so every copy is reported.
	optionalInputKinds: ['syntax-tree'],
	// Every span shared by the same pair of files is ONE finding: the identity is
	// the paths, so a second copy between two files already flagged is more
	// evidence for that finding rather than another one to accept or resolve.
	run: ({ inputs, options }): RawStandardsFinding[] => {
		const detected = inputs['clone-spans']?.spans ?? [];
		const syntax = inputs['syntax-tree'];
		const spans = syntax === undefined ? detected : dropForwardingSpans({ spans: detected, input: syntax, minTokens: options.minTokens ?? 0 });

		return [...groupByPair({ spans }).values()].map(({ files, spans: count, longest }) =>
			buildRawFinding({
				rule: 'duplicate-code-block',
				files,
				detail: `${count} duplicated block(s), the longest ${longest} lines`,
				guidance: 'The same code is written out in both files. Write it once where both can import it.',
			}),
		);
	},
};
