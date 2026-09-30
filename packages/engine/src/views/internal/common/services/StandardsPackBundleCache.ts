import { readdir, stat } from 'node:fs/promises';
import { isAbsolute, join, sep } from 'node:path';
import { toRepoRelativePath } from '#src/common/utils/toRepoRelativePath.ts';
import { FixtureSide } from '#src/contracts/views/FixtureSide.ts';
import type { StandardsPackBundle } from '#src/contracts/views/StandardsPackBundle.ts';
import type { StandardsPackRuleView } from '#src/contracts/views/StandardsPackRuleView.ts';
import type { LoadedStandardsRule } from '#src/standardsLibraries/common/types/LoadedStandardsRule.ts';
import { readStandardsLibrary } from '#src/standardsLibraries/readStandardsLibrary.ts';
import { readPackFixtures } from '#src/views/internal/common/utils/readPackFixtures.ts';
import { resolveRuleExample } from '#src/views/internal/common/utils/resolveRuleExample.ts';
import { toStandardsPackRuleListing } from '#src/views/internal/common/utils/toStandardsPackRuleListing.ts';

const getNewestMtime = async ({ root }: { root: string }) => {
	const entries = await readdir(root, { withFileTypes: true }).catch(() => []);
	let newest = 0;

	for (const entry of entries) {
		const path = join(root, entry.name);
		const at = entry.isDirectory()
			? await getNewestMtime({ root: path })
			: await stat(path).then(
					(stats) => stats.mtimeMs,
					() => 0,
				);

		newest = Math.max(newest, at);
	}

	return newest;
};

/**
 * Unlike `toRepoRelativePath`, a pack outside the repo is written out in full
 * rather than as a `../` walk, as a `standards-packs` entry would name it.
 */
const toPackEntryPath = ({ rootPath, cwd }: { rootPath: string; cwd: string }) => {
	const relativePath = toRepoRelativePath({ cwd, path: rootPath });
	// `..` is matched as a whole segment and the result is checked for being
	// absolute: a folder legitimately named `..packs` would begin with those two
	// characters without being outside anything, and a Windows path on another
	// drive comes back absolute rather than as a walk upward.
	const isOutside = relativePath === '..' || relativePath.startsWith(`..${sep}`) || isAbsolute(relativePath);
	let path = relativePath;

	if (isOutside) {
		path = rootPath;
	} else if (relativePath === '') {
		path = '.';
	}

	return path;
};

const toRuleView = async ({ rule }: { rule: LoadedStandardsRule }) => {
	// `run` and `inputKind` are deliberately dropped: a function cannot cross the
	// wire, and no page shows a check's source code.
	const fixtures = await readPackFixtures({ fixturesPath: rule.fixturesPath });
	const fixtureCounts = {
		pass: fixtures.filter((fixture) => fixture.side === FixtureSide.Pass).length,
		fail: fixtures.filter((fixture) => fixture.side === FixtureSide.Fail).length,
	};

	return {
		...toStandardsPackRuleListing({ rule, fixtureCounts }),
		prose: rule.prose,
		fixtures,
		example: resolveRuleExample({ declared: rule.example, fixtures }),
	};
};

/** The pack read off disk and folded whole, so nothing downstream ever holds a `LoadedStandardsLibrary`. */
const readBundle = async ({ packPath, isDefault, cwd }: { packPath: string; isDefault: boolean; cwd: string }) => {
	const pack = await readStandardsLibrary({ packPath });
	const rules: StandardsPackRuleView[] = [];

	for (const rule of pack.rules) {
		rules.push(await toRuleView({ rule }));
	}

	return {
		name: pack.name,
		...(pack.description === undefined ? {} : { description: pack.description }),
		...(pack.homepage === undefined ? {} : { homepage: pack.homepage }),
		isDefault,
		rootPath: pack.rootPath,
		path: toPackEntryPath({ rootPath: pack.rootPath, cwd }),
		built: pack.built === true,
		channels: [...new Set(pack.documents.map((document) => document.channel))].sort(),
		totals: {
			rules: rules.length,
			checked: rules.filter((rule) => rule.checked).length,
			judgment: rules.filter((rule) => !rule.checked).length,
			documents: pack.documents.length,
			withFixtures: rules.filter((rule) => rule.fixtureCounts.pass > 0 && rule.fixtureCounts.fail > 0).length,
		},
		documents: pack.documents.map((document) => ({
			set: document.set,
			path: document.path,
			channel: document.channel,
			intro: document.intro,
			ruleIds: document.ruleIds,
		})),
		rules,
	};
};

/**
 * A pack page's first paint reads the pack in several separate server-function
 * calls, so a per-call memo would save nothing; this instance outlives them.
 *
 * The in-flight promise is stored so concurrent callers share one read, and a
 * rejected one drops its entry so a failure is never cached. Each entry is
 * stamped with the newest mtime under the pack root, so an edited rule or
 * fixture is seen on the next request instead of after a restart.
 */
export class StandardsPackBundleCache {
	private readonly inFlight = new Map<string, { stamp: number; bundle: Promise<StandardsPackBundle> }>();

	/**
	 * Keyed by the pack root AND the repo, because `path` and `isDefault` are
	 * answers about that repo and the cached bundle has to be whole.
	 */
	async read({ packPath, isDefault, cwd }: { packPath: string; isDefault: boolean; cwd: string }): Promise<StandardsPackBundle> {
		// A NUL joins them because it is the one byte a path cannot hold, so no pair
		// of (pack root, repo) can ever spell another pair's key.
		const key = `${packPath}\u0000${cwd}`;
		const stamp = await getNewestMtime({ root: packPath });
		const cached = this.inFlight.get(key);
		let bundle = cached?.bundle;

		if (bundle === undefined || cached?.stamp !== stamp) {
			bundle = readBundle({ packPath, isDefault, cwd });
			this.inFlight.set(key, { stamp, bundle });

			const pending = bundle;

			void pending.catch(() => {
				if (this.inFlight.get(key)?.bundle === pending) {
					this.inFlight.delete(key);
				}
			});
		}

		return bundle;
	}
}
