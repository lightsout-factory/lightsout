import { readFile, realpath } from 'node:fs/promises';
import { basename, join, sep } from 'node:path';
import type { StandardsCheckModule, StandardsSet } from '@lightsout/standards-contracts';
import { z } from 'zod';
import { messageOf } from '#src/common/utils/messageOf.ts';
import { StandardsSeverity } from '#src/contracts/standardsCheck/StandardsSeverity.ts';
import { RuleExample } from '#src/contracts/views/RuleExample.ts';
import type { LoadedStandardsRule } from '#src/standardsLibraries/common/types/LoadedStandardsRule.ts';
import { parseDeclaration } from '#src/standardsLibraries/internal/common/parsing/parseDeclaration.ts';
import { hasFile } from '#src/standardsLibraries/internal/common/utils/hasFile.ts';
import { importCheckModule } from '#src/standardsLibraries/internal/common/utils/importCheckModule.ts';

interface Params {
	/** Absolute. */
	folderPath: string;
	set: StandardsSet;
	documentPath: string;
	/** The manifest name of the library holding the rule — the first half of its full name. */
	library: string;
	/** The loader throws these as one batch. */
	problems: string[];
}

const ruleDeclaration = z.object({
	summary: z.string().min(1),
	checked: z.union([z.boolean(), z.literal('partial')]).default(false),
	severity: z.enum(StandardsSeverity).default(StandardsSeverity.Advisory),
	options: z.record(z.string(), z.number()).default({}),
	example: RuleExample.optional(),
	requires: z.array(z.string().min(1)).default([]),
});

const getRuleDeclaration = async ({ folderPath, rulePath, found }: { folderPath: string; rulePath: string; found: string[] }) => {
	const filePath = `${rulePath}/rule.md`;
	const text = await readFile(join(folderPath, 'rule.md'), 'utf8').catch((error: unknown) => {
		found.push(`${filePath}: unreadable — ${messageOf({ error })}`);

		return undefined;
	});
	const parsed = text === undefined ? undefined : parseDeclaration({ text, schema: ruleDeclaration, filePath, problems: found });

	return { declaration: parsed?.declaration, prose: parsed?.body ?? '' };
};

/**
 * A rule declaring `checked: true` or `checked: partial` ships exactly one
 * check file: `check.ts`, or `check.js` for a library published to npm. Returns
 * the absolute path of the one it ships, or nothing when it ships none or both.
 */
const findCheckFile = async ({
	folderPath,
	rulePath,
	checked,
	found,
}: {
	folderPath: string;
	rulePath: string;
	checked?: boolean | 'partial';
	found: string[];
}) => {
	const shipped: string[] = [];

	for (const fileName of ['check.ts', 'check.js']) {
		if (await hasFile({ path: join(folderPath, fileName) })) {
			shipped.push(fileName);
		}
	}

	let checkFileName: string | undefined;

	if (shipped.length > 1) {
		found.push(`${rulePath}: ships both check.ts and check.js — a rule ships one`);
	} else if (shipped.length === 1) {
		checkFileName = shipped[0];
	} else if (checked === true || checked === 'partial') {
		found.push(`${rulePath}: declares checked: ${checked} but ships no check.ts or check.js`);
	}

	if (checked === false && checkFileName !== undefined) {
		found.push(`${rulePath}: ships a ${checkFileName} but declares neither checked: true nor checked: partial`);
	}

	return checkFileName === undefined ? undefined : join(folderPath, checkFileName);
};

/**
 * Node refuses to strip types from a check.ts whose real path is under
 * `node_modules`, so such a file is never imported: its library must publish
 * check.js. A workspace-linked library resolves to its source folder and
 * still loads its check.ts.
 */
const loadCheck = async ({ checkPath, rulePath, found }: { checkPath: string; rulePath: string; found: string[] }) => {
	const isTypeScript = basename(checkPath) === 'check.ts';
	const realPath = isTypeScript ? await realpath(checkPath) : checkPath;
	let check: StandardsCheckModule | undefined;

	if (isTypeScript && realPath.split(sep).includes('node_modules')) {
		found.push(`${rulePath}: check.ts sits under node_modules (${realPath}), where Node will not strip types — the library must publish check.js instead`);
	} else {
		try {
			check = await importCheckModule({ checkPath });
		} catch (error) {
			found.push(`${rulePath}: ${messageOf({ error })}`);
		}
	}

	return check;
};

/**
 * Problems are collected rather than thrown so one load reports every fault. A
 * rule with any problem is dropped whole: a half-loaded rule would be a check
 * or prose that silently stopped applying.
 */
export const parseRuleFolder = async ({ folderPath, set, documentPath, library, problems }: Params): Promise<LoadedStandardsRule | undefined> => {
	const folderName = basename(folderPath);
	const rulePath = `${documentPath}/${folderName}`;
	const found: string[] = [];
	const id = /^\d+-(.+)$/.exec(folderName)?.[1];

	if (id === undefined) {
		found.push(`${rulePath}: rule folder must be named <NN>-<rule-id>, e.g. 01-${folderName}`);
	}

	const { declaration, prose } = await getRuleDeclaration({ folderPath, rulePath, found });
	const checkPath = await findCheckFile({ folderPath, rulePath, checked: declaration?.checked, found });
	const declaresCheck = declaration !== undefined && declaration.checked !== false;
	const check = declaresCheck && checkPath !== undefined ? await loadCheck({ checkPath, rulePath, found }) : undefined;

	// Not required here: a shipped pack may omit fixtures. `standards-validate` demands them.
	const fixturesPath = join(folderPath, 'fixtures');

	problems.push(...found);

	let rule: LoadedStandardsRule | undefined;

	if (found.length === 0 && id !== undefined && declaration !== undefined) {
		rule = {
			id,
			name: `${library}/${id}`,
			library,
			set,
			documentPath,
			summary: declaration.summary,
			prose,
			checked: declaration.checked !== false,
			reviewed: declaration.checked !== true,
			defaultSeverity: declaration.severity,
			defaultOptions: declaration.options,
			// As written: readStandardsLibrary resolves the names once every rule of the library is loaded.
			requires: declaration.requires,
			...(declaration.example === undefined ? {} : { example: declaration.example }),
			...(check === undefined ? {} : { inputKinds: check.inputKinds, run: check.run }),
			fixturesPath,
		};
	}

	return rule;
};
