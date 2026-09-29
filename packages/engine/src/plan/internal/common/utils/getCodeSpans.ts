interface Params {
	line: string;
}

export const getCodeSpans = ({ line }: Params): string[] => [...line.matchAll(/`([^`]+)`/g)].map((match) => match[1].trim());
