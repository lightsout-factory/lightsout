import { isPathToken } from '#src/plan/internal/common/paths/isPathToken.ts';

interface Params {
	line: string;
}

export const pathFromLine = ({ line }: Params): string | undefined => {
	for (const match of line.matchAll(/`([^`]+)`/g)) {
		const token = match[1].trim().split(/\s+/)[0];

		if (isPathToken({ token })) {
			return token;
		}
	}

	return undefined;
};
