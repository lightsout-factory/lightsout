import { readFile } from 'node:fs/promises';
import { basename, join } from 'node:path';
import { readGitChangedFiles } from '#src/common/git/readGitChangedFiles.ts';
import { readGitHeadCommit } from '#src/common/git/readGitHeadCommit.ts';
import { canonicalJson } from '#src/common/json/canonicalJson.ts';
import { sha256 } from '#src/common/sha256.ts';
import type { Effort } from '#src/contracts/Effort.ts';
import type { LightsoutConfig } from '#src/contracts/LightsoutConfig/LightsoutConfig.ts';
import type { DecisionRow } from '#src/contracts/plan/decisions/DecisionRow.ts';
import type { GradeInputs } from '#src/contracts/plan/memory/GradeInputs.ts';
import type { ParsedPlan } from '#src/plan/common/types/ParsedPlan.ts';
import { parsePlan } from '#src/plan/parsePlan/parsePlan.ts';
import { getPlanDesignHash } from '#src/plan/runPlanGrade/getGradeInputs/common/getPlanDesignHash.ts';
import { getOverviewDesignHashes } from '#src/plan/runPlanGrade/getGradeInputs/getOverviewDesignHashes.ts';
import { planGradePromptTexts } from '#src/plan/runPlanGrade/getGradeInputs/planGradePromptTexts.ts';

interface Params {
	cwd: string;
	/** Overview included. */
	planPaths: string[];
	/** Brainstorm rows first. */
	decisions: DecisionRow[];
	standards?: string;
	config?: LightsoutConfig;
	model?: string;
	effort?: Effort;
}

/** `absent` is never a real digest, so an unreadable file never compares equal to a readable one. */
const hashFile = async ({ path }: { path: string }) => {
	const content = await readFile(path).catch(() => undefined);

	return content === undefined ? 'absent' : sha256({ content });
};

const planRelevantConfig = ({ config }: { config?: LightsoutConfig }) => ({
	plan: config?.plan,
	docs: config?.docs,
	gates: config?.gates,
	'packages-dir': config?.['packages-dir'],
	'executor-file-limit': config?.['executor-file-limit'],
});

/** Sorted so two passes over the same tree encode identically. */
const hashChangedFiles = async ({ cwd, changed }: { cwd: string; changed: string[] }) =>
	Promise.all([...changed].sort().map(async (path) => ({ path, sha256: await hashFile({ path: join(cwd, path) }) })));

/** A `Global constraint:` row reaches the whole plan, so whatever phases it names are left out of its entry. */
const toDecisionEntry = ({ row }: { row: DecisionRow }) => {
	const phases = row.question.startsWith('Global constraint:') ? undefined : row.phases;

	return {
		sha256: sha256({ content: canonicalJson({ value: row }) }),
		questionSha256: sha256({ content: row.question }),
		...(phases === undefined ? {} : { phases }),
	};
};

const overviewBase = 'overview.md';

const readPlanFile = async ({ path }: { path: string }) => {
	const file = basename(path);
	const content = await readFile(path).catch(() => undefined);

	return content === undefined
		? { file, sha256: 'absent' }
		: { file, sha256: sha256({ content }), plan: parsePlan({ content: content.toString('utf8'), base: file }) };
};

/**
 * The overview's generated spans are safe to leave out of its hash: blocking
 * checks stop the pass before this runs if they are stale, and the rows the log
 * was rendered from are fingerprinted one by one beside it.
 */
const readDecisionPart = ({ decisions, overviewDesign }: { decisions: DecisionRow[]; overviewDesign?: string }) => ({
	...(overviewDesign === undefined ? {} : { overviewDesign }),
	rows: decisions.map((row) => toDecisionEntry({ row })),
});

/**
 * When no span of the overview can be credited, the overview is treated as
 * wholly shared, which widens the pass rather than crediting a phase with a span
 * that may not be its own.
 */
const designHashesOf = ({ read }: { read: { file: string; plan?: ParsedPlan }[] }) => {
	const overview = read.find((entry) => entry.file === overviewBase)?.plan;
	const phaseFiles = read.map(({ file }) => file).filter((file) => file !== overviewBase);
	const split = overview === undefined ? undefined : getOverviewDesignHashes({ overview, phaseFiles });
	const hashes = new Map<string, string>();

	for (const { file, plan } of read) {
		if (plan === undefined) {
			continue;
		}

		const attributed = split !== undefined && !('error' in split) ? split.attributed.get(file) : undefined;

		hashes.set(file, file === overviewBase && split !== undefined ? split.shared : getPlanDesignHash({ plan, attributed }));
	}

	return hashes;
};

/**
 * An unread changed-file list is left ABSENT rather than written as an empty
 * one: "nobody looked" and "nothing changed" must never compare equal. Hashing
 * the changed files' contents rather than their names is what makes a dirty
 * tree comparable at all.
 */
export const getGradeInputs = async ({ cwd, planPaths, decisions, standards, config, model, effort }: Params): Promise<GradeInputs> => {
	const read = (await Promise.all(planPaths.map((path) => readPlanFile({ path })))).sort((left, right) => (left.file > right.file ? 1 : -1));
	const designHashes = designHashesOf({ read });
	const planFiles = read.map(({ file, sha256: fileSha256 }) => {
		const designSha256 = designHashes.get(file);

		return { file, sha256: fileSha256, ...(designSha256 === undefined ? {} : { designSha256 }) };
	});
	const gradedCommit = await readGitHeadCommit({ cwd });
	const changed = await readGitChangedFiles({ cwd });
	const decisionLog = readDecisionPart({ decisions, overviewDesign: designHashes.get(overviewBase) });
	const measured = {
		planFiles,
		gradedCommit,
		changedFiles: changed === undefined ? undefined : await hashChangedFiles({ cwd, changed }),
		standards: standards === undefined ? undefined : sha256({ content: standards }),
		config: sha256({ content: canonicalJson({ value: planRelevantConfig({ config }) }) }),
		prompts: sha256({ content: planGradePromptTexts.join('\n') }),
		model,
		effort,
		decisionLog,
	};

	return { ...measured, sha256: sha256({ content: canonicalJson({ value: measured }) }) };
};
