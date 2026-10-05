interface Params {
	code: string;
}

// No-op when output is piped. The returned (text) => string shape is a
// contract: callers pass it on as an emphasis callback.
export const paint =
	({ code }: Params): ((text: string) => string) =>
	(text: string) =>
		process.stdout.isTTY ? `\u001b[${code}m${text}\u001b[0m` : text;
