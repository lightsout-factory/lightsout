import { readdir } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { join } from 'node:path';
import type { RawStandardsFinding } from '@lightsout/standards-contracts';
import type ts from 'typescript';
import { messageOf } from '#src/common/utils/messageOf.ts';
import { findMissingRequirements } from '#src/standards/findMissingRequirements.ts';
import { typescriptInputKinds } from '#src/standardsCheck/internal/common/constants/typescriptInputKinds.ts';
import { checkFixtureTree } from '#src/standardsCheck/internal/common/utils/fixtureChecks/checkFixtureTree.ts';
import { checkRuleExample } from '#src/standardsCheck/internal/common/utils/fixtureChecks/checkRuleExample.ts';
import type { LoadedStandardsLibrary } from '#src/standardsLibraries/common/types/LoadedStandardsLibrary.ts';
import { findUnresolvedRequirements } from '#src/standardsLibraries/findUnresolvedRequirements.ts';
import { resolveStandardsPack } from '#src/standardsLibraries/resolveStandardsPack.ts';

interface Params {
	library: LoadedStandardsLibrary;
	/** What the library's packs resolve against — the library itself and the built-in one. */
	libraries: LoadedStandardsLibrary[];
}

const FixtureSide = {
	Fail: 'fail',
	Pass: 'pass',
} as const;

type FixtureSide = (typeof FixtureSide)[keyof typeof FixtureSide];

/**
 * Resolved through `require` rather than a literal `import('typescript')`,
 * which a bundler would answer by pulling the whole compiler into the shipped
 * program. An install that has none cannot validate those rules, which is a
 * note, not a fault in the library.
 */
const getEngineTypescript = () => {
	let compiler: typeof ts | undefined;

	try {
		// Anchored on the running program, so this is the engine's own dependency.
		// require() is typed `any`; the declaration above is what states the shape.
		compiler = createRequire(process.argv[1])('typescript');
	} catch {
		compiler = undefined;
	}

	return compiler;
};

/** Loading accepts a library without fixtures — a shipped library carries none — so this is where the pair is demanded. */
const missingFixtureSides = async ({ fixturesPath }: { fixturesPath: string }) => {
	const missing: FixtureSide[] = [];

	for (const side of Object.values(FixtureSide)) {
		const entries = await readdir(join(fixturesPath, side)).catch(() => undefined);

		if (entries === undefined || entries.length === 0) {
			missing.push(side);
		}
	}

	return missing;
};

const namePaths = ({ found }: { found: RawStandardsFinding[] }) => {
	const paths = [...new Set(found.flatMap((finding) => finding.files.slice(0, 1).map((file) => file.path)))];

	return paths.length > 3 ? `${paths.slice(0, 3).join(', ')}, …` : paths.join(', ');
};

/**
 * A rule's own pass fixture proves the false positive someone already found;
 * this holds every checked rule, including ones added later, to silence on
 * framework-owned code.
 *
 * Its own pass rather than inside the per-rule loop, which skips a rule whose
 * fixture pair is missing: the invariant is unconditional.
 */
const checkFrameworkOwned = async ({ library, compiler }: { library: LoadedStandardsLibrary; compiler?: typeof ts }) => {
	const { frameworkOwnedFixturesPath } = library;
	// Recorded, never required — a library that holds no rule to the invariant is
	// told so, the same way a judgment-only rule is.
	const heldNothing = { problems: [], notes: [`${library.name}: no fixtures/framework-owned/ — no rule was held to the framework-owned invariant`] };

	if (frameworkOwnedFixturesPath === undefined) {
		return heldNothing;
	}

	const entries = await readdir(frameworkOwnedFixturesPath, { withFileTypes: true }).catch(() => []);
	// One framework per folder, in name order, so a list of problems reads the
	// same way twice running.
	const frameworks = entries
		.filter((entry) => entry.isDirectory())
		.map((entry) => entry.name)
		.sort();

	if (frameworks.length === 0) {
		return heldNothing;
	}

	const problems: string[] = [];

	for (const framework of frameworks) {
		for (const rule of library.rules) {
			const { run, inputKind } = rule;

			// Skipped without a word: the per-rule loop already noted a judgment-only
			// rule and a kind this install cannot parse, and saying it again per
			// framework would bury the list it belongs in.
			if (run === undefined || inputKind === undefined || (compiler === undefined && typescriptInputKinds.has(inputKind))) {
				continue;
			}

			try {
				const found = await checkFixtureTree({
					cwd: join(frameworkOwnedFixturesPath, framework),
					rule,
					inputKind,
					run,
					label: `fixtures/framework-owned/${framework}/`,
					compiler,
				});

				if (found.length > 0) {
					problems.push(
						`${rule.id}: the ${framework} framework-owned tree produced ${found.length} finding(s) — a checked rule stays silent on code its framework owns (${namePaths({ found })})`,
					);
				}
			} catch (error) {
				problems.push(`${rule.id}: the ${framework} framework-owned tree could not be checked — ${messageOf({ error })}`);
			}
		}
	}

	return { problems, notes: [] };
};

/**
 * Each pack file must resolve: every include entry names something, rule-settings name rules in the pack, and no packs include each other in a cycle.
 * A pack that resolves is judged on its own for requirements it leaves out — a warning, since a team may mean to take one topic pack alone.
 */
const checkPackFiles = ({ library, libraries }: { library: LoadedStandardsLibrary; libraries: LoadedStandardsLibrary[] }) => {
	const problems: string[] = [];
	const warnings: string[] = [];

	for (const packFile of library.packs) {
		const address = `${library.name}/${packFile.name}`;

		try {
			const pack = resolveStandardsPack({ address, libraries });

			for (const { rule, required } of findMissingRequirements({ rules: pack.rules })) {
				warnings.push(`${pack.name}: ${rule} requires ${required}, which the pack does not send to agents`);
			}
		} catch (error) {
			problems.push(messageOf({ error }));
		}
	}

	return { problems, warnings };
};

/**
 * The question load time deliberately does not ask: whether a check catches
 * what the rule's prose describes is authoring work, paid for by nobody else.
 *
 * Fixture runs also refuse a site key that does not start with the rule's own id.
 */
export const validateStandardsLibrary = async ({ library, libraries }: Params): Promise<{ problems: string[]; notes: string[]; warnings: string[] }> => {
	// Read from the library rather than inferred from missing fixtures: an authored
	// library that ships no fixtures yet is a real authoring gap and must keep
	// reading as one.
	if (library.built) {
		return {
			problems: [
				`${library.name} is a built pack — its fixtures were left behind when it was built, so there is nothing here to validate. Point --library at the authored source.`,
			],
			notes: [],
			warnings: [],
		};
	}

	// Resolving TypeScript means loading a multi-megabyte module; a library whose
	// rules never ask for a parsed tree should not pay for it.
	const hasParsingRule = library.rules.some((rule) => rule.inputKind !== undefined && typescriptInputKinds.has(rule.inputKind));
	const compiler = hasParsingRule ? getEngineTypescript() : undefined;
	const problems: string[] = [];
	const notes: string[] = [];

	for (const rule of library.rules) {
		const { run, inputKind } = rule;
		const missing = await missingFixtureSides({ fixturesPath: rule.fixturesPath });

		if (missing.length > 0) {
			// Asked of every rule, judgment-only included: their pair is what the
			// review agent's accuracy is measured against.
			problems.push(...missing.map((side) => `${rule.id}: fixtures/${side}/ is missing or empty — every rule ships a fixture pair`));
			continue;
		}

		problems.push(...(await checkRuleExample({ rule })));

		if (run === undefined || inputKind === undefined) {
			notes.push(`${rule.id}: judgment-only — fixtures reserved for agent accuracy`);
			continue;
		}

		if (compiler === undefined && typescriptInputKinds.has(inputKind)) {
			notes.push(`${rule.id}: not validated — its ${inputKind} input needs a typescript this install does not have`);
			continue;
		}

		for (const side of Object.values(FixtureSide)) {
			try {
				const found = await checkFixtureTree({ cwd: join(rule.fixturesPath, side), rule, inputKind, run, label: `fixtures/${side}/`, compiler });

				if (side === FixtureSide.Fail && found.length === 0) {
					problems.push(`${rule.id}: the fail fixture produced no finding — the check does not catch what the rule describes`);
				}

				if (side === FixtureSide.Pass && found.length > 0) {
					problems.push(`${rule.id}: the pass fixture produced ${found.length} finding(s) — the check flags code the rule allows`);
				}
			} catch (error) {
				problems.push(`${rule.id}: the ${side} fixture could not be checked — ${messageOf({ error })}`);
			}
		}
	}

	const frameworkOwned = await checkFrameworkOwned({ library, compiler });

	problems.push(...frameworkOwned.problems);
	notes.push(...frameworkOwned.notes);
	problems.push(...findUnresolvedRequirements({ libraries }));

	const packFiles = checkPackFiles({ library, libraries });

	problems.push(...packFiles.problems);

	return { problems, notes, warnings: packFiles.warnings };
};
