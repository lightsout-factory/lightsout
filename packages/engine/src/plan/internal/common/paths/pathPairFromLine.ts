import { isPathToken } from '#src/plan/internal/common/paths/isPathToken.ts';

interface Params {
	line: string;
}

/** Recognised only here, so only a move heading may name a folder: elsewhere a path still needs an extension. */
const isFolderToken = ({ token }: { token: string }) =>
	token.endsWith('/') &&
	!token.startsWith('/') &&
	token
		.slice(0, -1)
		.split('/')
		.every((segment) => segment !== '' && segment !== '.' && segment !== '..');

/**
 * Undefined unless both paths are present, so a malformed move heading is
 * reported rather than parsed as a one-path move. A heading names two files or
 * two folders; a folder pair carries `folder: true` with each trailing `/`
 * stripped, and one of each is malformed, since a half-folder move has no meaning.
 */
export const pathPairFromLine = ({ line }: Params): { from: string; to: string; folder?: true } | undefined => {
	const paths: { path: string; folder: boolean }[] = [];

	for (const match of line.matchAll(/`([^`]+)`/g)) {
		const token = match[1].trim().split(/\s+/)[0];

		if (isPathToken({ token })) {
			paths.push({ path: token, folder: false });
		} else if (isFolderToken({ token })) {
			paths.push({ path: token.slice(0, -1), folder: true });
		}

		if (paths.length === 2) {
			break;
		}
	}

	const [from, to] = paths;
	let pair: { from: string; to: string; folder?: true } | undefined;

	if (from !== undefined && to !== undefined && from.folder === to.folder) {
		pair = from.folder ? { from: from.path, to: to.path, folder: true } : { from: from.path, to: to.path };
	}

	return pair;
};
