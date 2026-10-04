import { readdir } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { join } from 'node:path';
import type ts from 'typescript';
import { messageOf } from '#src/common/messageOf.ts';
import type { LoadedStandardsLibrary } from '#src/common/types/LoadedStandardsLibrary.ts';
import { findMissingRequirements } from '#src/standards/findMissingRequirements.ts';
import { typescriptInputKinds } from '#src/standardsCheck/common/constants/typescriptInputKinds.ts';
import { checkFixtureTree } from '#src/standardsCheck/validateStandardsLibrary/checkFixtureTree.ts';
import { checkLibraryProse } from '#src/standardsCheck/validateStandardsLibrary/checkLibraryProse/checkLibraryProse.ts';
import { checkRuleExample } from '#src/standardsCheck/validateStandardsLibrary/checkRuleExample.ts';
import { findUnresolvedRequirements } from '#src/standardsLibraries/findUnresolvedRequirements.ts';
import { resolveStandardsPack } from '#src/standardsLibraries/resolveStandardsPack/resolveStandardsPack.ts';

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
			// Every conditional pack applies, so a pack is judged whole, whichever package it would reach.
			const pack = resolveStandardsPack({ addresses: [address], libraries, dependencies: undefined });

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
	const hasParsingRule = library.rules.some((rule) => rule.inputKinds?.some((kind) => typescriptInputKinds.has(kind)) === true);
	const compiler = hasParsingRule ? getEngineTypescript() : undefined;
	const problems: string[] = [];
	const notes: string[] = [];

	for (const rule of library.rules) {
		const { run, inputKinds } = rule;
		const missing = await missingFixtureSides({ fixturesPath: rule.fixturesPath });

		if (missing.length > 0) {
			// Asked of every rule, agent-only included: their pair is what the
			// review agent's accuracy is measured against.
			problems.push(...missing.map((side) => `${rule.id}: fixtures/${side}/ is missing or empty — every rule ships a fixture pair`));
			continue;
		}

		problems.push(...(await checkRuleExample({ rule })));

		if (run === undefined || inputKinds === undefined) {
			notes.push(`${rule.id}: agent check — fixtures reserved for agent accuracy`);
			continue;
		}

		const needingTypescript = inputKinds.filter((kind) => typescriptInputKinds.has(kind));

		if (compiler === undefined && needingTypescript.length > 0) {
			notes.push(`${rule.id}: not validated — its ${needingTypescript.join(' and ')} input needs a typescript this install does not have`);
			continue;
		}

		for (const side of Object.values(FixtureSide)) {
			try {
				const found = await checkFixtureTree({ cwd: join(rule.fixturesPath, side), rule, inputKinds, run, label: `fixtures/${side}/`, compiler });

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

	problems.push(...checkLibraryProse({ library }));
	problems.push(...findUnresolvedRequirements({ libraries }));

	const packFiles = checkPackFiles({ library, libraries });

	problems.push(...packFiles.problems);

	return { problems, notes, warnings: packFiles.warnings };
};
