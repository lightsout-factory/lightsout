import { readFile, realpath } from 'node:fs/promises';
import { basename, join, sep } from 'node:path';
import { type StandardsCheckModule, StandardsRuleChecks, type StandardsSet } from '@lightsout/standards-contracts';
import { z } from 'zod';
import type { LoadedStandardsRule } from '#src/common/types/LoadedStandardsRule.ts';
import { messageOf } from '#src/common/utils/messageOf.ts';
import { StandardsSeverity } from '#src/contracts/standardsCheck/StandardsSeverity.ts';
import { RuleExample } from '#src/contracts/views/RuleExample.ts';
import { hasFile } from '#src/standardsLibraries/readStandardsLibrary/parseTopicFolder/common/hasFile.ts';
import { parseDeclaration } from '#src/standardsLibraries/readStandardsLibrary/parseTopicFolder/common/parseDeclaration/parseDeclaration.ts';
import { importCheckModule } from '#src/standardsLibraries/readStandardsLibrary/parseTopicFolder/parseRuleFolder/importCheckModule.ts';

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
	checks: z.enum(StandardsRuleChecks),
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
 * A rule with a deterministic check (`checks: deterministic` or `checks: both`)
 * ships exactly one check file: `check.ts`, or `check.js` for a library
 * published to npm. Returns the absolute path of the one it ships, or nothing
 * when it ships none or both.
 */
const findCheckFile = async ({
	folderPath,
	rulePath,
	checks,
	found,
}: {
	folderPath: string;
	rulePath: string;
	checks?: StandardsRuleChecks;
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
	} else if (checks === StandardsRuleChecks.Deterministic || checks === StandardsRuleChecks.Both) {
		found.push(`${rulePath}: declares checks: ${checks} but ships no check.ts or check.js`);
	}

	if (checks === StandardsRuleChecks.Agent && checkFileName !== undefined) {
		found.push(`${rulePath}: ships a ${checkFileName} but declares checks: agent`);
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
	const checkPath = await findCheckFile({ folderPath, rulePath, checks: declaration?.checks, found });
	const deterministic = declaration !== undefined && declaration.checks !== StandardsRuleChecks.Agent;
	const check = deterministic && checkPath !== undefined ? await loadCheck({ checkPath, rulePath, found }) : undefined;

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
			deterministic,
			agent: declaration.checks !== StandardsRuleChecks.Deterministic,
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
