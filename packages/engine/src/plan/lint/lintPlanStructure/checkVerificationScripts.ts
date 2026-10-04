import { readFile } from 'node:fs/promises';
import { basename, join } from 'node:path';
import { extractRunScriptName } from '#src/common/config/extractRunScriptName.ts';
import { FindingSeverity } from '#src/contracts/plan/grade/FindingSeverity.ts';
import { StructuralCheck } from '#src/contracts/plan/grade/StructuralCheck.ts';
import type { StructuralFinding } from '#src/contracts/plan/grade/StructuralFinding.ts';
import { getManifestScriptKeys } from '#src/plan/common/getManifestScriptKeys.ts';
import { getPlanNamedPaths } from '#src/plan/common/getPlanNamedPaths.ts';
import type { ParsedPlan } from '#src/plan/common/types/ParsedPlan.ts';

interface Params {
	plan: ParsedPlan;
	cwd: string;
	/** Absolute. */
	planPath: string;
	/** The finding label: this file's basename. */
	phase: string;
	packagesDir: string;
	/** Full-command overrides from config, never checked as package scripts. */
	configCommands: Set<string>;
	/** Scripts an earlier-or-same phase declares it adds, available before any package.json has them. */
	declaredScripts: Set<string>;
}

const scriptNameOf = ({ command }: { command: string }) => {
	// Any `… run <script>` form (pnpm/npm/yarn/turbo, with or without filter
	// flags) resolves through the same parser the doctor and scoped gates use,
	// so the three can never disagree about which script a command invokes.
	let scriptName = extractRunScriptName({ command });
	const tokens = command.split(/\s+/);

	if (scriptName === undefined && tokens[0] === 'pnpm') {
		// `--filter`/`-F` consume their selector argument; `--filter=<sel>` is a
		// single token.
		let index = 1;

		while (tokens[index]?.startsWith('-')) {
			index += tokens[index] === '--filter' || tokens[index] === '-F' ? 2 : 1;
		}

		scriptName = tokens[index];
	}

	if (scriptName === undefined && tokens[0] === 'yarn' && tokens[1] !== undefined && !tokens[1].startsWith('-')) {
		scriptName = tokens[1];
	}

	return scriptName;
};

const getPackageDirs = ({ plan, packagesDir }: { plan: ParsedPlan; packagesDir: string }) => {
	const packageDirs = new Set<string>();

	for (const path of getPlanNamedPaths({ plan, includeMirrors: true })) {
		if (path.startsWith(`${packagesDir}/`)) {
			const segment = path.slice(packagesDir.length + 1).split('/')[0];

			if (segment) {
				packageDirs.add(segment);
			}
		}
	}

	return packageDirs;
};

/** An unreadable manifest contributes nothing rather than failing the check. */
const getAvailableScripts = async ({ cwd, packagesDir, packageDirs }: { cwd: string; packagesDir: string; packageDirs: Set<string> }) => {
	const manifestPaths = [join(cwd, 'package.json'), ...[...packageDirs].map((dir) => join(cwd, packagesDir, dir, 'package.json'))];
	const availableScripts = new Set<string>();

	for (const manifestPath of manifestPaths) {
		const raw = await readFile(manifestPath, 'utf8').catch(() => undefined);

		if (!raw) {
			continue;
		}

		for (const key of getManifestScriptKeys({ raw })) {
			availableScripts.add(key);
		}
	}

	return availableScripts;
};

/**
 * Every path the plan names counts, a move included, so a phase whose only
 * package work is a move still resolves that package's manifest. Anything it
 * cannot decide is skipped, never guessed into a finding.
 */
export const checkVerificationScripts = async ({
	plan,
	cwd,
	planPath,
	phase,
	packagesDir,
	configCommands,
	declaredScripts,
}: Params): Promise<StructuralFinding[]> => {
	const findings: StructuralFinding[] = [];
	const availableScripts = await getAvailableScripts({ cwd, packagesDir, packageDirs: getPackageDirs({ plan, packagesDir }) });

	for (const command of plan.verificationCommands) {
		if (configCommands.has(command)) {
			continue;
		}

		const scriptName = scriptNameOf({ command });

		if (scriptName === undefined) {
			continue;
		}

		if (!availableScripts.has(scriptName) && !declaredScripts.has(scriptName)) {
			findings.push({
				check: StructuralCheck.ScriptExists,
				severity: FindingSeverity.Blocking,
				phase,
				issue: `verification command '${command}' references package script '${scriptName}' which is not in any target package.json`,
				location: `${basename(planPath)} → Verification`,
				fix: `use a script that exists, or add '${scriptName}' to the package.json`,
			});
		}
	}

	return findings;
};
