import { readFile } from 'node:fs/promises';
import { basename, join } from 'node:path';
import type { StandardsCheckModule, StandardsSet } from '@lightsout/standards-contracts';
import { z } from 'zod';
import { messageOf } from '#src/common/utils/messageOf.ts';
import { StandardsSeverity } from '#src/contracts/standardsCheck/StandardsSeverity.ts';
import { RuleExample } from '#src/contracts/views/RuleExample.ts';
import type { LoadedStandardsRule } from '#src/standardsPacks/common/types/LoadedStandardsRule.ts';
import { parseDeclaration } from '#src/standardsPacks/internal/common/parsing/parseDeclaration.ts';
import { hasFile } from '#src/standardsPacks/internal/common/utils/hasFile.ts';
import { importCheckModule } from '#src/standardsPacks/internal/common/utils/importCheckModule.ts';

interface Params {
	/** Absolute. */
	folderPath: string;
	set: StandardsSet;
	documentPath: string;
	/** The loader throws these as one batch. */
	problems: string[];
}

const ruleDeclaration = z.object({
	summary: z.string().min(1),
	checked: z.boolean().default(false),
	severity: z.enum(StandardsSeverity).default(StandardsSeverity.Advisory),
	options: z.record(z.string(), z.number()).default({}),
	example: RuleExample.optional(),
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
 * Problems are collected rather than thrown so one load reports every fault. A
 * rule with any problem is dropped whole: a partial rule would be a check or
 * prose that silently stopped applying.
 */
export const parseRuleFolder = async ({ folderPath, set, documentPath, problems }: Params): Promise<LoadedStandardsRule | undefined> => {
	const folderName = basename(folderPath);
	const rulePath = `${documentPath}/${folderName}`;
	const found: string[] = [];
	const id = /^\d+-(.+)$/.exec(folderName)?.[1];

	if (id === undefined) {
		found.push(`${rulePath}: rule folder must be named <NN>-<rule-id>, e.g. 01-${folderName}`);
	}

	const { declaration, prose } = await getRuleDeclaration({ folderPath, rulePath, found });
	const checkPath = join(folderPath, 'check.ts');
	const hasCheck = await hasFile({ path: checkPath });

	if (declaration?.checked === true && !hasCheck) {
		found.push(`${rulePath}: declares checked: true but ships no check.ts`);
	}

	if (declaration?.checked === false && hasCheck) {
		found.push(`${rulePath}: ships a check.ts but does not declare checked: true`);
	}

	// Not required here: a shipped pack may omit fixtures. `standards-validate` demands them.
	const fixturesPath = join(folderPath, 'fixtures');

	let check: StandardsCheckModule | undefined;

	if (declaration?.checked === true && hasCheck) {
		try {
			check = await importCheckModule({ checkPath });
		} catch (error) {
			found.push(`${rulePath}: ${messageOf({ error })}`);
		}
	}

	problems.push(...found);

	let rule: LoadedStandardsRule | undefined;

	if (found.length === 0 && id !== undefined && declaration !== undefined) {
		rule = {
			id,
			set,
			documentPath,
			summary: declaration.summary,
			prose,
			// The owning document stamps its own channel over this default.
			channel: 'base',
			checked: declaration.checked,
			defaultSeverity: declaration.severity,
			defaultOptions: declaration.options,
			...(declaration.example === undefined ? {} : { example: declaration.example }),
			...(check === undefined ? {} : { inputKind: check.inputKind, run: check.run }),
			fixturesPath,
		};
	}

	return rule;
};
