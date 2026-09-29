import type { LightsoutConfig } from '#src/contracts/LightsoutConfig.ts';
import { PackagesSource } from '#src/contracts/run/PackagesSource.ts';
import { readPlanPackages } from '#src/pipeline/readPlanPackages.ts';
import { scanPlanPackagePaths } from '#src/pipeline/scanPlanPackagePaths.ts';

interface Params {
	config: LightsoutConfig;
	/** Scope already on the manifest — non-empty means a resume settled this. */
	current: string[];
	/** The `--packages` flag, when the caller passed one. */
	packages?: string[];
	planContent: string;
	packagesDir: string;
	/** Package dirs that exist on disk, from listWorkspacePackages. Empty = unknown, so nothing is reconciled. */
	knownPackages: string[];
}

const noScopeError = ({ packagesDir }: { packagesDir: string }) =>
	`package-gates is configured but no package scope could be resolved — add a \`packages:\` list to the plan front-matter, pass --packages <a,b>, or reference concrete ${packagesDir}/<name>/ paths in the plan.`;

const partitionKnown = ({ declared, knownPackages }: { declared: string[]; knownPackages: string[] }) => ({
	kept: declared.filter((name) => knownPackages.includes(name)),
	missing: declared.filter((name) => !knownPackages.includes(name)),
});

/**
 * The chain is `--packages` flag → plan front-matter `packages:` list →
 * concrete package paths in the plan body → hard error; a run that cannot name
 * its scope must stop, because every later gate would be scoped to a guess.
 * Names lifted from the plan's prose are filtered to real packages and the
 * dropped ones come back on `ignored`; a name a human declared is never
 * filtered, because it is a mistake worth stopping for.
 */
export const resolvePackageScope = ({
	config,
	current,
	packages,
	planContent,
	packagesDir,
	knownPackages,
}: Params): { scope?: { packages: string[]; packagesSource: PackagesSource }; ignored?: string[] } | { error: string; ignored?: string[] } => {
	if (!config['package-gates'] || current.length > 0) {
		return {};
	}

	const fromFlag = packages;
	const fromFrontMatter = fromFlag ? undefined : readPlanPackages({ planContent });
	const fromPlanPaths = (fromFlag ?? fromFrontMatter) ? undefined : scanPlanPackagePaths({ planContent, packagesDir });
	const declared = fromFlag ?? fromFrontMatter ?? fromPlanPaths;

	if (!declared || declared.length === 0) {
		return { error: noScopeError({ packagesDir }) };
	}

	const packagesSource = fromFlag ? PackagesSource.Flag : fromFrontMatter ? PackagesSource.FrontMatter : PackagesSource.PlanPaths;
	const { kept, missing } = knownPackages.length === 0 ? { kept: declared, missing: [] } : partitionKnown({ declared, knownPackages });

	if (packagesSource !== PackagesSource.PlanPaths && missing.length > 0) {
		return { error: `package scope names ${missing.join(', ')} — no such package under ${packagesDir}/. Packages that exist: ${knownPackages.join(', ')}.` };
	}

	if (kept.length === 0) {
		return { error: noScopeError({ packagesDir }), ignored: missing };
	}

	return { scope: { packages: kept, packagesSource }, ...(missing.length > 0 ? { ignored: missing } : {}) };
};
