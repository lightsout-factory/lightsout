interface Params {
	text: string;
}

const findBalancedEnd = ({ text, start }: { text: string; start: number }) => {
	let depth = 0;
	let inString = false;
	let escaped = false;

	for (let index = start; index < text.length; index += 1) {
		const char = text[index];

		if (inString) {
			if (escaped) {
				escaped = false;
			} else if (char === '\\') {
				escaped = true;
			} else if (char === '"') {
				inString = false;
			}

			continue;
		}

		if (char === '"') {
			inString = true;
		} else if (char === '{') {
			depth += 1;
		} else if (char === '}') {
			depth -= 1;

			if (depth === 0) {
				return index;
			}
		}
	}

	return -1;
};

/** Last, because the report is the agent's closing act — anything object-shaped earlier is prose or examples. */
const lastEmbeddedJsonObject = ({ text }: Params): unknown => {
	let found: unknown;
	let start = text.indexOf('{');

	while (start !== -1) {
		const end = findBalancedEnd({ text, start });

		if (end === -1) {
			start = text.indexOf('{', start + 1);
			continue;
		}

		try {
			found = JSON.parse(text.slice(start, end + 1));
			start = text.indexOf('{', end + 1);
		} catch {
			start = text.indexOf('{', start + 1);
		}
	}

	return found;
};

/**
 * Agents are instructed to emit bare JSON; tolerated deviations, in order: the
 * LAST parseable fenced block, then the last JSON object embedded in prose. Last
 * everywhere, because an agent that corrects itself mid-message leaves the fixed
 * report after the broken one. Strictness lives in the role's zod contract, not
 * in finding the payload.
 */
export const extractJsonReport = ({ text }: Params): unknown => {
	const trimmed = text.trim();

	try {
		return JSON.parse(trimmed);
	} catch {
		// fall through to the tolerant tiers
	}

	const fencedBodies = [...trimmed.matchAll(/```(?:json)?\s*([\s\S]*?)```/g)].map((match) => match[1]);

	for (const body of fencedBodies.reverse()) {
		if (!body) {
			continue;
		}

		try {
			return JSON.parse(body.trim());
		} catch {
			// try the previous fenced block
		}
	}

	return lastEmbeddedJsonObject({ text: trimmed });
};
