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
	problems: string[];
}

/**
 * A document naming no channel always applies; a named channel means prose,
 * checks and review sit out unless the repo runs that framework.
 */
const documentDeclaration = z.object({
	channel: z.string().min(1).default('base'),
});

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

/** The document's channel is stamped onto its rules, so a rule is never in play while its document is not. */
export const parseTopicFolder = async ({
	folderPath,
	documentPath,
	set,
	problems,
}: Params): Promise<{ document: LoadedStandardsTopic; rules: LoadedStandardsRule[] } | undefined> => {
	const text = await readFile(join(folderPath, 'topic.md'), 'utf8').catch(() => undefined);

	if (text === undefined) {
		problems.push(`${documentPath}/topic.md: unreadable`);

		return undefined;
	}

	const { declaration, body: intro } = parseDeclaration({
		text,
		schema: documentDeclaration,
		filePath: `${documentPath}/topic.md`,
		problems,
	});
	const rules: LoadedStandardsRule[] = [];

	for (const name of await listRuleFolders({ folderPath })) {
		const rule = await parseRuleFolder({ folderPath: join(folderPath, name), set, documentPath, problems });

		if (rule !== undefined && declaration !== undefined) {
			rules.push({ ...rule, channel: declaration.channel });
		}
	}

	let parsedDocument: { document: LoadedStandardsTopic; rules: LoadedStandardsRule[] } | undefined;

	if (declaration !== undefined) {
		parsedDocument = {
			document: { set, path: documentPath, channel: declaration.channel, intro, ruleIds: rules.map((rule) => rule.id) },
			rules,
		};
	}

	return parsedDocument;
};
