import { isPathToken } from '#src/plan/internal/common/paths/isPathToken.ts';

interface Params {
	line: string;
}

/** Undefined unless both paths are present, so a malformed move heading is reported rather than parsed as a one-path move. */
export const pathPairFromLine = ({ line }: Params): { from: string; to: string } | undefined => {
	const paths: string[] = [];

	for (const match of line.matchAll(/`([^`]+)`/g)) {
		const token = match[1].trim().split(/\s+/)[0];

		if (isPathToken({ token })) {
			paths.push(token);
		}

		if (paths.length === 2) {
			break;
		}
	}

	return paths.length === 2 ? { from: paths[0], to: paths[1] } : undefined;
};
