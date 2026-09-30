import { getDirectory } from '../paths/getDirectory.ts';
import type { PathAliases } from '../types/PathAliases.ts';
import { isRecord } from '../utils/isRecord.ts';

const readTargets = ({ target }: { target: unknown }): string[] | undefined => {
	if (typeof target === 'string') {
		return [target];
	}

	if (Array.isArray(target)) {
		return target.filter((entry): entry is string => typeof entry === 'string');
	}

	return isRecord(target) && 'default' in target ? readTargets({ target: target.default }) : undefined;
};

interface Params {
	/** Repo-relative path of the package.json this text came from — its folder anchors the targets. */
	manifestPath: string;
	text: string;
}

/**
 * An empty `patterns` map is a real answer: an empty `imports` block states that
 * nothing is aliased. `undefined` is reserved for a manifest with no `imports`
 * at all, or text that is not JSON, so the caller stays free to try the
 * tsconfig beside it — answering "no aliases" there would turn every aliased
 * import in the package into a confident "external".
 *
 * Read with `JSON.parse` rather than the comment-stripping machinery a tsconfig
 * needs: `package.json` is strict JSON.
 */
export const readPackageImports = ({ manifestPath, text }: Params): PathAliases | undefined => {
	let data: unknown;

	try {
		data = JSON.parse(text);
	} catch {
		return undefined;
	}

	const imports = isRecord(data) ? data.imports : undefined;

	if (!isRecord(imports)) {
		return undefined;
	}

	const patterns = new Map<string, string[]>();

	for (const [pattern, target] of Object.entries(imports)) {
		const targets = readTargets({ target });

		if (targets !== undefined) {
			patterns.set(pattern, targets);
		}
	}

	return { base: getDirectory({ path: manifestPath }), patterns };
};
