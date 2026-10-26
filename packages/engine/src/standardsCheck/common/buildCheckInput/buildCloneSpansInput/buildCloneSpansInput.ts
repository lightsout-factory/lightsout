import { Detector, MemoryStore } from '@jscpd/core';
import { Tokenizer } from '@jscpd/tokenizer';
import { type CloneSpan, type CloneSpansInput, StandardsInputKind } from '@lightsout/standards-contracts';
import { blankImportSpans } from '#src/standardsCheck/common/buildCheckInput/buildCloneSpansInput/blankImportSpans.ts';
import { readIntoCache } from '#src/standardsCheck/common/readIntoCache.ts';

interface Params {
	cwd: string;
	source: string[];
	/** The asking check's own resolved options — the engine honors them because it runs the detector. */
	options: Record<string, number>;
	cache: Map<string, string>;
}

const formatOf = ({ path }: { path: string }) => (/\.(m|c)?tsx?$/.test(path) ? 'typescript' : 'javascript');

/**
 * The engine runs the detector rather than the rule, so the rule's `minTokens`
 * reaches it as an option instead of a rule opening files of its own.
 *
 * Imports are blanked first (newline-preserving): they are non-deduplicable by
 * construction, so counting them would report work nobody can do, and blanking
 * keeps the reported line numbers true. Which other copies are acceptable is
 * the check's to judge from the spans it is handed.
 */
export const buildCloneSpansInput = async ({ cwd, source, options, cache }: Params): Promise<CloneSpansInput> => {
	const { minTokens } = options;

	const texts = await readIntoCache({ cwd, paths: source, cache });
	const detector = new Detector(new Tokenizer(), new MemoryStore(), [], { minTokens, minLines: 5 });
	const spans: CloneSpan[] = [];

	for (const [path, text] of texts) {
		for (const clone of await detector.detect(path, blankImportSpans({ text }), formatOf({ path }))) {
			const a = clone.duplicationA;
			const b = clone.duplicationB;

			spans.push({
				files: [
					{ path: b.sourceId, startLine: b.start.line, endLine: b.end.line },
					{ path: a.sourceId, startLine: a.start.line, endLine: a.end.line },
				],
				// Both ends are optional in jscpd's types, and a span it could not
				// place counts as no tokens.
				tokens: (a.end.position ?? 0) - (a.start.position ?? 0),
			});
		}
	}

	return { kind: StandardsInputKind.CloneSpans, cwd, source, spans };
};
