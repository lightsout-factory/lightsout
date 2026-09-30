import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { StandardsSet } from '@lightsout/standards-contracts';
import { z } from 'zod';
import type { LoadedStandardsRule } from '#src/standardsLibraries/common/types/LoadedStandardsRule.ts';
import type { LoadedStandardsTopic } from '#src/standardsLibraries/common/types/LoadedStandardsTopic.ts';
import { parseDeclaration } from '#src/standardsLibraries/internal/common/parsing/parseDeclaration.ts';
import { parseRuleFolder } from '#src/standardsLibraries/internal/common/parsing/parseRuleFolder.ts';
import { hasFile } from '#src/standardsLibraries/internal/common/utils/hasFile.ts';

interface Params {
	/** Absolute; contains topic.md. */
	folderPath: string;
	/** Pack-relative. */
	documentPath: string;
	set: StandardsSet;
	/** The manifest name of the library holding the topic. */
	library: string;
	problems: string[];
}

/** topic.md declares nothing: any front matter key there is a problem, never silently ignored. */
const topicDeclaration = z.object({}).strict();

const listRuleFolders = async ({ folderPath }: { folderPath: string }) => {
	const entries = await readdir(folderPath, { withFileTypes: true }).catch(() => []);
	const directories = entries
		.filter((entry) => entry.isDirectory())
		.map((entry) => entry.name)
		.sort();
	const folders: string[] = [];

	for (const name of directories) {
		const isRule = await hasFile({ path: join(folderPath, name, 'rule.md') });

		if (isRule) {
			folders.push(name);
		}
	}

	return folders;
};

/** A topic whose topic.md fails to parse yields nothing, so its rules never load without the background they share. */
export const parseTopicFolder = async ({
	folderPath,
	documentPath,
	set,
	library,
	problems,
}: Params): Promise<{ document: LoadedStandardsTopic; rules: LoadedStandardsRule[] } | undefined> => {
	const text = await readFile(join(folderPath, 'topic.md'), 'utf8').catch(() => undefined);

	if (text === undefined) {
		problems.push(`${documentPath}/topic.md: unreadable`);

		return undefined;
	}

	const { declaration, body: intro } = parseDeclaration({
		text,
		schema: topicDeclaration,
		filePath: `${documentPath}/topic.md`,
		problems,
	});
	const rules: LoadedStandardsRule[] = [];

	for (const name of await listRuleFolders({ folderPath })) {
		const rule = await parseRuleFolder({ folderPath: join(folderPath, name), set, documentPath, library, problems });

		if (rule !== undefined && declaration !== undefined) {
			rules.push(rule);
		}
	}

	let parsedDocument: { document: LoadedStandardsTopic; rules: LoadedStandardsRule[] } | undefined;

	if (declaration !== undefined) {
		parsedDocument = {
			document: { set, library, path: documentPath, intro, ruleIds: rules.map((rule) => rule.id) },
			rules,
		};
	}

	return parsedDocument;
};
