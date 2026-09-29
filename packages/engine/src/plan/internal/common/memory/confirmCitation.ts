import { collapseText } from '#src/plan/internal/common/memory/collapseText.ts';
import { citationPathToken } from '#src/plan/internal/common/paths/citationPathToken.ts';
import { citedPathExists } from '#src/plan/internal/common/paths/citedPathExists.ts';

interface Params {
	cwd: string;
	citation: string;
	/** The text the citation must be found in when it is not a path. */
	planText: string;
}

type CitationCheck = { ok: true } | { ok: false; reason: string };

/** Long enough that a heading alone (`## Decision Log`) cannot close a record, short enough that one Decision Log cell can. */
const minimumCitationLength = 24;

const confirmPath = async ({ cwd, token }: { cwd: string; token: string }): Promise<CitationCheck> => {
	const present = await citedPathExists({ cwd, token });

	return present ? { ok: true } : { ok: false, reason: `cited ${token}, which is not on disk` };
};

const confirmQuote = ({ citation, planText }: { citation: string; planText: string }): CitationCheck => {
	const quote = collapseText({ text: citation });

	if (quote.length < minimumCitationLength) {
		return { ok: false, reason: `citation shorter than ${minimumCitationLength} characters: ${citation}` };
	}

	const found = collapseText({ text: planText }).includes(quote);

	return found ? { ok: true } : { ok: false, reason: `citation not found in the plan text: ${citation}` };
};

/**
 * An invented citation would turn an unresolved blocker into an approval. A
 * verbatim quote is the one match the engine can make without guessing what the
 * judge meant.
 */
export const confirmCitation = async ({ cwd, citation, planText }: Params): Promise<CitationCheck> => {
	const token = citationPathToken({ citation });

	return token === undefined ? confirmQuote({ citation, planText }) : confirmPath({ cwd, token });
};
