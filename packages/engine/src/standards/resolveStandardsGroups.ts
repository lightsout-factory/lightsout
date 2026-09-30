import { join } from 'node:path';
import { selectsNoStandards } from '#src/common/config/selectsNoStandards.ts';
import { defaultPackagesDir } from '#src/common/constants/defaultPackagesDir.ts';
import { listWorkspacePackages } from '#src/common/workspace/listWorkspacePackages.ts';
import type { LightsoutConfig } from '#src/contracts/LightsoutConfig.ts';
import { StandardsPackSource } from '#src/contracts/standards/StandardsPackSource.ts';
import type { StandardsGroup } from '#src/standards/common/types/StandardsGroup.ts';
import { detectStandardsPack } from '#src/standards/detectStandardsPack.ts';
import { resolveRuleStates } from '#src/standards/internal/resolveRuleStates.ts';
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
	address: string;
	source: StandardsPackSource;
}

const byName = (first: string, second: string) => first.localeCompare(second);

const refuseUnknownPackages = ({
	packagePacks,
	workspace,
	packagesDir,
}: {
	packagePacks: Record<string, string>;
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

/** A package's own entry, then the repo pack, then detection from its own manifest; `standards-pack: false` leaves an unnamed package with none. */
const choosePack = async ({ name, manifestPath, config }: { name: string; manifestPath: string; config: LightsoutConfig | undefined }) => {
	const own = name === '' ? undefined : config?.['package-standards-packs']?.[name];
	const repo = config?.['standards-pack'];
	let choice: PackChoice | undefined;

	if (own !== undefined) {
		choice = { name, address: own, source: StandardsPackSource.Named };
	} else if (typeof repo === 'string') {
		choice = { name, address: repo, source: StandardsPackSource.Named };
	} else if (repo === undefined) {
		choice = { name, address: await detectStandardsPack({ manifestPath }), source: StandardsPackSource.Detected };
	}

	return choice;
};

/** Packages sharing an address and a source share a group; the root's group first, then by address. */
const formGroups = ({ choices }: { choices: PackChoice[] }) => {
	const byKey = new Map<string, { address: string; source: StandardsPackSource; packages: string[] }>();

	for (const { name, address, source } of choices) {
		const key = `${address}\u0000${source}`;
		const entry = byKey.get(key) ?? { address, source, packages: [] };

		entry.packages.push(name);
		byKey.set(key, entry);
	}

	return [...byKey.values()]
		.map((entry) => ({ ...entry, packages: [...entry.packages].sort(byName) }))
		.sort(
			(first, second) =>
				Number(second.packages.includes('')) - Number(first.packages.includes('')) ||
				byName(first.address, second.address) ||
				byName(first.source, second.source),
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
 * @throws {Error} When a library or a pack cannot be loaded, a `package-standards-packs` key names no workspace package, or a `standards-rule-settings` entry names no rule in any selected pack.
 */
export const resolveStandardsGroups = async ({ cwd, config, packages }: Params): Promise<StandardsGroup[]> => {
	if (selectsNoStandards({ config })) {
		return [];
	}

	const packagePacks = config?.['package-standards-packs'] ?? {};
	const packagesDir = config?.['packages-dir'] ?? defaultPackagesDir;
	const workspace = (await listWorkspacePackages({ cwd, packagesDir })).sort(byName);

	refuseUnknownPackages({ packagePacks, workspace, packagesDir });

	const choices = await Promise.all([
		choosePack({ name: '', manifestPath: join(cwd, 'package.json'), config }),
		...workspace.map((name) => choosePack({ name, manifestPath: join(cwd, packagesDir, name, 'package.json'), config })),
	]);
	const formed = formGroups({ choices: choices.filter((choice): choice is PackChoice => choice !== undefined) });
	const libraries = await resolveStandardsLibraries({ cwd, config });
	const packs = new Map<string, ResolvedStandardsPack>();
	const resolved = formed.map((entry) => {
		const pack = packs.get(entry.address) ?? resolveStandardsPack({ address: entry.address, libraries });

		packs.set(entry.address, pack);

		return { ...entry, pack };
	});
	const statesPerPack = resolveRuleStates({ packs: resolved.map(({ pack }) => pack), ruleSettings: config?.['standards-rule-settings'] });
	const groups = resolved.map(({ packages: covered, pack, source }, index) => ({ packages: covered, pack, source, states: statesPerPack[index] }));

	return keepScope({ groups, packages });
};
