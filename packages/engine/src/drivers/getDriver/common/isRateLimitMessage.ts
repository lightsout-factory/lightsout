interface Params {
	text: string;
}

const rateLimitPattern =
	/usage limit|rate limit|limit reached|limit will reset|quota|hit your [^.\n]{0,40}limit|\b(?:weekly|daily|hourly|monthly)\s+limit\b|\b(?:status|error|code)\D{0,6}529\b|overloaded/i;

/**
 * Only consulted on an error path, so agent prose about rate limits cannot trip
 * it. A false negative degrades to an ordinary step failure rather than a park.
 */
export const isRateLimitMessage = ({ text }: Params): boolean => rateLimitPattern.test(text);
