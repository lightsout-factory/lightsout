import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { StandardsLibraryRoot, StandardsSet } from '@lightsout/standards-contracts';
import { standardsLibraryRootFile } from '#src/common/constants/standardsLibraryRootFile.ts';
import { messageOf } from '#src/common/utils/messageOf.ts';
import type { LoadedStandardsLibrary } from '#src/standardsLibraries/common/types/LoadedStandardsLibrary.ts';
import type { LoadedStandardsRule } from '#src/standardsLibraries/common/types/LoadedStandardsRule.ts';
import type { LoadedStandardsTopic } from '#src/standardsLibraries/common/types/LoadedStandardsTopic.ts';
import { parsePackFolder } from '#src/standardsLibraries/internal/common/parsing/parsePackFolder.ts';
import { parseTopicFolder } from '#src/standardsLibraries/internal/common/parsing/parseTopicFolder.ts';
import { formatSchemaIssues } from '#src/standardsLibraries/internal/common/utils/formatSchemaIssues.ts';
import { hasFile } from '#src/standardsLibraries/internal/common/utils/hasFile.ts';
import { resolveRuleRequirements } from '#src/standardsLibraries/internal/common/utils/resolveRuleRequirements.ts';

interface Params {
	packPath: string;
}

interface WalkParams {
	folderPath: string;
	documentPath: string;
	set: StandardsSet;
	library: string;
	problems: string[];
	documents: LoadedStandardsTopic[];
	rules: LoadedStandardsRule[];
}

/**
 * Any folder holding a topic.md is a document and its subtree stops there —
 * everything below it is that document's rule folders. Folders with no marker
 * file (a pack's own `common/` helpers, grouping folders) are passed through.
 */
const walk = async ({ folderPath, documentPath, set, library, problems, documents, rules }: WalkParams) => {
	const entries = await readdir(folderPath, { withFileTypes: true }).catch(() => undefined);

	if (entries === undefined) {
		return;
	}

	if (entries.some((entry) => entry.name === 'topic.md')) {
		const parsed = await parseTopicFolder({ folderPath, documentPath, set, library, problems });

		if (parsed !== undefined) {
			documents.push(parsed.document);
			rules.push(...parsed.rules);
		}
	} else {
		const directories = entries
			.filter((entry) => entry.isDirectory())
			.map((entry) => entry.name)
			.sort();

		for (const name of directories) {
			await walk({ folderPath: join(folderPath, name), documentPath: `${documentPath}/${name}`, set, library, problems, documents, rules });
		}
	}
};

/** Two folders claiming one rule id would make config overrides and site keys ambiguous. */
const findDuplicateIds = ({ rules }: { rules: LoadedStandardsRule[] }) => {
	const owners = new Map<string, string>();
	const duplicates: string[] = [];

	for (const rule of rules) {
		const owner = owners.get(rule.id);

		if (owner === undefined) {
			owners.set(rule.id, rule.documentPath);
		} else {
			duplicates.push(`duplicate rule id "${rule.id}": claimed by ${owner} and ${rule.documentPath}`);
		}
	}

	return duplicates;
};

/**
 * Load-time validation is structure and the honesty rule only — whether each
 * rule's declaration matches what its folder actually ships. Whether a check
 * catches what it claims is a different question, answered by
 * `lightsout standards-validate` against the rule's own fixtures.
 *
 * Every problem found across the whole walk is thrown together, so a pack
 * author fixes one list rather than replaying load-fix-load per fault.
 *
 * @param packPath - absolute pack root (the folder holding lightsout-standards.json)
 * @throws {Error} When the root file is missing or invalid, or the tree has any structural or honesty problem.
 */
export const readStandardsLibrary = async ({ packPath }: Params): Promise<LoadedStandardsLibrary> => {
	const rootFilePath = join(packPath, standardsLibraryRootFile);
	const rootText = await readFile(rootFilePath, 'utf8').catch(() => undefined);

	if (rootText === undefined) {
		throw new Error(`standards pack root file not found: ${rootFilePath}`);
	}

	let rootData: unknown;

	try {
		rootData = JSON.parse(rootText);
	} catch (error) {
		throw new Error(`standards pack root file is not valid JSON (${rootFilePath}): ${messageOf({ error })}`);
	}

	const root = StandardsLibraryRoot.safeParse(rootData);

	if (!root.success) {
		throw new Error(`standards pack root file is invalid (${rootFilePath}): ${formatSchemaIssues({ issues: root.error.issues, subject: 'root file' })}`);
	}

	const problems: string[] = [];
	const documents: LoadedStandardsTopic[] = [];
	const rules: LoadedStandardsRule[] = [];

	for (const set of [StandardsSet.Code, StandardsSet.Tests]) {
		await walk({ folderPath: join(packPath, set), documentPath: set, set, library: root.data.name, problems, documents, rules });
	}

	const packs = await parsePackFolder({ folderPath: join(packPath, 'packs'), problems });

	if (documents.length === 0) {
		problems.push('pack declares no documents — code/ and tests/ hold no folder with a topic.md');
	}

	problems.push(...findDuplicateIds({ rules }));

	// After the duplicate check: a short id resolves only while one rule holds it.
	const requirements = resolveRuleRequirements({ library: root.data.name, rules });

	problems.push(...requirements.problems);

	if (problems.length > 0) {
		throw new Error(`standards pack failed to load (${packPath}):\n${problems.map((problem) => `- ${problem}`).join('\n')}`);
	}

	// Recorded, never required: a pack that does not ship one is told so by
	// `standards-validate` rather than failed by it.
	const frameworkOwnedFixturesPath = join(packPath, 'fixtures', 'framework-owned');
	const hasFrameworkOwned = await hasFile({ path: frameworkOwnedFixturesPath });

	return {
		name: root.data.name,
		formatVersion: root.data.formatVersion,
		built: root.data.built,
		description: root.data.description,
		homepage: root.data.homepage,
		rootPath: packPath,
		...(hasFrameworkOwned ? { frameworkOwnedFixturesPath } : {}),
		documents,
		rules: requirements.rules,
		packs,
	};
};
