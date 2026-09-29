import { isAbsolute, resolve } from 'node:path';
import { readOptionalConfig } from '#src/common/config/readOptionalConfig.ts';
import { messageOf } from '#src/common/utils/messageOf.ts';
import type { StandardsPackBundle } from '#src/contracts/views/StandardsPackBundle.ts';
import { resolveAuthoredStandardsPack } from '#src/standardsPacks/resolveAuthoredStandardsPack.ts';
import { resolveDefaultStandardsPack } from '#src/standardsPacks/resolveDefaultStandardsPack.ts';
import { standardsPackBundleCache } from '#src/views/internal/common/constants/standardsPackBundleCache.ts';

interface PackRoot {
	packPath: string;
	isDefault: boolean;
}

/**
 * Never a throw: a page has to render on a machine with no config, no repo and
 * no authored pack. The run-time `resolveStandardsPacks` rightly throws, since a
 * run that declared standards and did not get them must not proceed.
 */
const resolvePackRoots = async ({ cwd }: { cwd: string }) => {
	let roots: PackRoot[] = [];

	try {
		const configured = (await readOptionalConfig({ cwd }))?.['standards-packs'];

		if (configured === undefined) {
			// The authored folder when one is beside `cwd`, else the copy the engine
			// ships — which carries no fixtures, and whose `built` says so.
			roots = [{ packPath: resolveAuthoredStandardsPack({ cwd }) ?? resolveDefaultStandardsPack(), isDefault: true }];
		} else if (configured !== false) {
			roots = configured.map((entry) => ({ packPath: isAbsolute(entry) ? entry : resolve(cwd, entry), isDefault: false }));
		}
	} catch (error) {
		console.warn(`standards packs could not be listed for ${cwd}: ${messageOf({ error })}`);
	}

	return roots;
};

interface Params {
	cwd: string;
}

/**
 * A pack that will not load is skipped with a server-log line rather than
 * failing the page. Two packs claiming one name are the same case, because a
 * URL addresses a pack by its name: the first one listed wins.
 */
export const listStandardsPackBundles = async ({ cwd }: Params): Promise<StandardsPackBundle[]> => {
	const bundles: StandardsPackBundle[] = [];
	const claimed = new Map<string, string>();

	for (const { packPath, isDefault } of await resolvePackRoots({ cwd })) {
		const bundle = await standardsPackBundleCache.read({ packPath, isDefault, cwd }).catch((error: unknown) => {
			console.warn(`standards pack at ${packPath} could not be read: ${messageOf({ error })}`);

			return undefined;
		});
		if (bundle === undefined) {
			continue;
		}

		const owner = claimed.get(bundle.name);

		if (owner === undefined) {
			claimed.set(bundle.name, bundle.rootPath);
			bundles.push(bundle);
		} else {
			console.warn(`standards pack name "${bundle.name}" is claimed by ${owner} and ${bundle.rootPath} — the second one is left out`);
		}
	}

	return bundles;
};
