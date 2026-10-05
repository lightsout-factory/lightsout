import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { pathExists } from '#src/common/paths/pathExists.ts';
import type { AuthoredFacts } from '#src/contracts/plan/facts/AuthoredFacts.ts';
import type { PathVerification } from '#src/contracts/plan/facts/PathVerification.ts';
import { getManifestScriptKeys } from '#src/plan/common/getManifestScriptKeys.ts';

interface Params {
	cwd: string;
	facts: AuthoredFacts;
}

/**
 * An agent claiming a path exists is not evidence; this is. A script is missing
 * only when absent from the root package.json and every affected package's.
 * Never throws: the result is data.
 */
export const verifyFacts = async ({ cwd, facts }: Params): Promise<PathVerification> => {
	const paths = facts.areas.flatMap((area) => [...area.filesToModify.map((file) => file.path), ...area.patternsToMirror.map((pattern) => pattern.path)]);
	const missingPaths: string[] = [];

	for (const path of paths) {
		const exists = await pathExists({ path: join(cwd, path) });

		if (!exists) {
			missingPaths.push(path);
		}
	}

	const missingScripts: string[] = [];
	let scriptsChecked = 0;

	for (const area of facts.areas) {
		if (area.scripts.length === 0) {
			continue;
		}

		const manifestPaths = [join(cwd, 'package.json'), ...area.affectedPackages.map((pkg) => join(cwd, pkg, 'package.json'))];
		const available = new Set<string>();

		for (const manifestPath of manifestPaths) {
			const raw = await readFile(manifestPath, 'utf8').catch(() => undefined);

			if (raw) {
				for (const key of getManifestScriptKeys({ raw })) {
					available.add(key);
				}
			}
		}

		for (const script of area.scripts) {
			scriptsChecked += 1;

			if (!available.has(script.key)) {
				missingScripts.push(script.key);
			}
		}
	}

	return {
		pathsChecked: paths.length,
		missingPaths,
		scriptsChecked,
		missingScripts,
	};
};
