import { join } from 'node:path';
import { selectsNoStandards } from '#src/common/config/selectsNoStandards.ts';
import { defaultPackagesDir } from '#src/common/constants/defaultPackagesDir.ts';
import { listWorkspacePackages } from '#src/common/workspace/listWorkspacePackages.ts';
import { readDependencyNames } from '#src/common/workspace/readDependencyNames.ts';
import type { LightsoutConfig } from '#src/contracts/LightsoutConfig.ts';
import type { StandardsGroup } from '#src/standards/common/types/StandardsGroup.ts';
import { resolveRuleStates } from '#src/standards/internal/resolveRuleStates.ts';
import type { LoadedStandardsLibrary } from '#src/standardsLibraries/common/types/LoadedStandardsLibrary.ts';
import type { ResolvedStandardsPack } from '#src/standardsLibraries/common/types/ResolvedStandardsPack.ts';
import { resolveStandardsLibraries } from '#src/standardsLibraries/resolveStandardsLibraries.ts';
import { resolveStandardsPack } from '#src/standardsLibraries/resolveStandardsPack.ts';

interface Params {
	cwd: string;
	/** The repo's config, absent on a repo that has none. */
	config: LightsoutConfig | undefined;
	/** The command's package scope (folder names under packages-dir). Undefined = every workspace package. */
	packages?: string[];
}

interface PackChoice {
	/** '' is the repo root group. */
	name: string;
	/** The pack addresses the config names for the package, in listed order. */
	addresses: string[];
	/** Absolute path of the package's own `package.json`, whose dependencies decide each conditional pack. */
	manifestPath: string;
}

interface PackagePack {
	/** '' is the repo root group. */
	name: string;
	pack: ResolvedStandardsPack;
}

const byName = (first: string, second: string) => first.localeCompare(second);

const refuseUnknownPackages = ({
	packagePacks,
	workspace,
	packagesDir,
}: {
	packagePacks: Record<string, string | string[]>;
	workspace: string[];
	packagesDir: string;
}) => {
	const unknown = Object.keys(packagePacks).filter((name) => !workspace.includes(name));

	if (unknown.length > 0) {
		const existing = workspace.length > 0 ? workspace.join(', ') : 'none';

		throw new Error(
			`package-standards-packs names ${unknown.map((name) => `"${name}"`).join(', ')}, which is not a workspace package under ${packagesDir}/ — the workspace packages are: ${existing}`,
		);
	}
};

/**
 * Settings with no pack to apply to are refused rather than dropped: a repo
 * that tuned rules meant to have standards. An explicit `false` is a choice,
 * and its settings simply wait for the pack to come back.
 */
const refuseSettingsWithoutPack = ({ config }: { config: LightsoutConfig | undefined }) => {
	if (config?.['standards-pack'] === undefined && Object.keys(config?.['standards-rule-settings'] ?? {}).length > 0) {
		throw new Error(
			'standards-rule-settings is set but standards-pack is not, so its settings apply to nothing — standards are opt-in: add "standards-pack": "lightsout/standards" to turn on the bundled standards, or "standards-pack": false to run with none',
		);
	}
};

/** A package's own entry, then the repo's `standards-pack`. Standards are opt-in: a package neither names gets none. */
const choosePack = ({ name, manifestPath, config }: { name: string; manifestPath: string; config: LightsoutConfig | undefined }) => {
	const own = name === '' ? undefined : config?.['package-standards-packs']?.[name];
	const repo = config?.['standards-pack'];
	const selection = own ?? (repo === false ? undefined : repo);

	return selection === undefined ? undefined : { name, addresses: [selection].flat(), manifestPath };
};

/** A conditional pack is judged against the package's own manifest, so two packages naming one pack can resolve differently. */
const resolvePackagePack = async ({ choice, libraries }: { choice: PackChoice; libraries: LoadedStandardsLibrary[] }) => {
	const dependencies = new Set((await readDependencyNames({ manifestPath: choice.manifestPath })) ?? []);

	return { name: choice.name, pack: resolveStandardsPack({ addresses: choice.addresses, libraries, dependencies }) };
};

/** Packages whose packs and applied conditional packs match share a group; the root's group first, then by pack name. */
const formGroups = ({ packagePacks }: { packagePacks: PackagePack[] }) => {
	const byKey = new Map<string, { pack: ResolvedStandardsPack; packages: string[] }>();

	for (const { name, pack } of packagePacks) {
		const key = [pack.name, ...pack.conditionalPacks].join('\u0000');
		const entry = byKey.get(key) ?? { pack, packages: [] };

		entry.packages.push(name);
		byKey.set(key, entry);
	}

	return [...byKey.values()]
		.map((entry) => ({ ...entry, packages: [...entry.packages].sort(byName) }))
		.sort(
			(first, second) =>
				Number(second.packages.includes('')) - Number(first.packages.includes('')) ||
				byName(first.pack.name, second.pack.name) ||
				byName(first.pack.conditionalPacks.join(), second.pack.conditionalPacks.join()),
		);
};

/** A scope name that is no workspace package is a set of root files, which the root group already covers. */
const keepScope = ({ groups, packages }: { groups: StandardsGroup[]; packages: string[] | undefined }) => {
	if (packages === undefined) {
		return groups;
	}

	return groups
		.map((group) => ({ ...group, packages: group.packages.filter((name) => name === '' || packages.includes(name)) }))
		.filter((group) => group.packages.length > 0);
};

/**
 * The one place a command learns which standards apply: every caller asks
 * here, so a run's prose, checks and review can never disagree about a
 * package's pack. Every workspace package's pack is resolved whatever the
 * scope, and the repo's `standards-rule-settings` are applied last over all of
 * them, so a scoped call accepts exactly the config an unscoped one does.
 *
 * @throws {Error} When a library or a pack cannot be loaded, a `package-standards-packs` key names no workspace package, a `standards-rule-settings` entry names no rule in any selected pack, or `standards-rule-settings` is set while nothing names a pack.
 */
export const resolveStandardsGroups = async ({ cwd, config, packages }: Params): Promise<StandardsGroup[]> => {
	if (selectsNoStandards({ config })) {
		refuseSettingsWithoutPack({ config });

		return [];
	}

	const packagesDir = config?.['packages-dir'] ?? defaultPackagesDir;
	const workspace = (await listWorkspacePackages({ cwd, packagesDir })).sort(byName);

	refuseUnknownPackages({ packagePacks: config?.['package-standards-packs'] ?? {}, workspace, packagesDir });

	const choices = [
		choosePack({ name: '', manifestPath: join(cwd, 'package.json'), config }),
		...workspace.map((name) => choosePack({ name, manifestPath: join(cwd, packagesDir, name, 'package.json'), config })),
	].filter((choice): choice is PackChoice => choice !== undefined);
	const libraries = await resolveStandardsLibraries({ cwd, config });
	const packagePacks = await Promise.all(choices.map((choice) => resolvePackagePack({ choice, libraries })));
	const formed = formGroups({ packagePacks });
	const statesPerPack = resolveRuleStates({ packs: formed.map(({ pack }) => pack), ruleSettings: config?.['standards-rule-settings'] });
	const groups = formed.map(({ packages: covered, pack }, index) => ({ packages: covered, pack, states: statesPerPack[index] }));

	return keepScope({ groups, packages });
};
