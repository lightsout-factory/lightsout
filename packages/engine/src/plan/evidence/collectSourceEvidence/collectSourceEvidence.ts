import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { defaultPackagesDir } from '#src/common/constants/defaultPackagesDir.ts';
import { readJsonFile } from '#src/common/json/readJsonFile.ts';
import { writeJsonFile } from '#src/common/json/writeJsonFile.ts';
import { sha256 } from '#src/common/sha256.ts';
import { resolveConsumerTypescript } from '#src/common/workspace/resolveConsumerTypescript.ts';
import type { LightsoutConfig } from '#src/contracts/LightsoutConfig/LightsoutConfig.ts';
import type { SourceEvidenceEntry } from '#src/contracts/plan/evidence/SourceEvidenceEntry.ts';
import { SourceEvidenceIndex } from '#src/contracts/plan/evidence/SourceEvidenceIndex.ts';
import { SourceEvidenceKind } from '#src/contracts/plan/evidence/SourceEvidenceKind.ts';
import type { PlanFacts } from '#src/contracts/plan/facts/PlanFacts.ts';
import { extractSourceEvidence } from '#src/plan/evidence/collectSourceEvidence/extractSourceEvidence.ts';
import { sourceEvidencePath } from '#src/plan/evidence/collectSourceEvidence/sourceEvidencePath.ts';
import { wholeFileEvidenceLimit } from '#src/plan/evidence/common/constants/wholeFileEvidenceLimit.ts';

interface Params {
	cwd: string;
	/** Kebab plan name — the folder the plan's own files live in. */
	name: string;
	facts: PlanFacts;
	config?: LightsoutConfig;
}

const atPath = ({ at }: { at: string }) => at.replace(/:\d+(?::\d+)?$/, '');

/**
 * Nothing is discovered here: the explorer already wrote down which files
 * matter, and re-walking the repository is the cost this module exists to avoid.
 */
const wantedPaths = ({ facts }: { facts: PlanFacts }) => {
	const wanted = new Map<string, string[]>();
	const record = ({ path, role }: { path: string; role: string }) => {
		const roles = wanted.get(path) ?? [];

		wanted.set(path, roles.includes(role) ? roles : [...roles, role]);
	};

	for (const area of facts.areas) {
		for (const { path, role } of area.filesToModify) {
			record({ path, role });
		}

		for (const { path, takeaway } of area.patternsToMirror) {
			record({ path, role: takeaway });
		}

		for (const { name, signature, at } of area.integrationPoints) {
			record({ path: atPath({ at }), role: `integration point: ${name} — ${signature}` });
		}
	}

	return wanted;
};

const collectEntry = ({
	path,
	content,
	hash,
	roles,
	compiler,
}: {
	path: string;
	content: string;
	hash: string;
	roles: string[];
	compiler: ReturnType<typeof resolveConsumerTypescript>;
}): SourceEvidenceEntry => {
	const bytes = Buffer.byteLength(content);
	const shared = { path, sha256: hash, bytes, roles };

	if (bytes <= wholeFileEvidenceLimit || compiler === undefined) {
		return { ...shared, kind: SourceEvidenceKind.Whole, text: content, definitions: [] };
	}

	const { text, definitions } = extractSourceEvidence({ path, content, compiler });

	return { ...shared, kind: SourceEvidenceKind.Definitions, text, definitions };
};

/**
 * A repository with no TypeScript resolvable stores the whole file rather than
 * a guess.
 *
 * The excluded-source-path list is deliberately not applied: a facts record that
 * names a generated or vendored file named it on purpose. A path not on disk is
 * data rather than an error, because `verifyFacts` never checked an integration
 * point's `at`.
 */
export const collectSourceEvidence = async ({ cwd, name, facts, config }: Params): Promise<SourceEvidenceIndex> => {
	const path = await sourceEvidencePath({ cwd, name });
	// An unreadable record is discarded rather than thrown on: it holds bytes the
	// repository still has, so collecting them again is honest.
	const previous = await readJsonFile({ path, schema: SourceEvidenceIndex });
	const stored = new Map((previous?.entries ?? []).map((entry) => [entry.path, entry]));
	const compiler = resolveConsumerTypescript({ cwd, packagesDir: config?.['packages-dir'] ?? defaultPackagesDir });
	const entries: SourceEvidenceEntry[] = [];

	for (const [relative, roles] of wantedPaths({ facts })) {
		const content = await readFile(join(cwd, relative), 'utf8').catch(() => undefined);

		if (content === undefined) {
			entries.push({ path: relative, sha256: '', kind: SourceEvidenceKind.Missing, bytes: 0, text: '', roles, definitions: [] });

			continue;
		}

		const hash = sha256({ content });
		const reusable = stored.get(relative);

		entries.push(
			reusable !== undefined && reusable.sha256 === hash ? { ...reusable, roles } : collectEntry({ path: relative, content, hash, roles, compiler }),
		);
	}

	const index = SourceEvidenceIndex.parse({
		planName: name,
		entries: entries.sort((left, right) => left.path.localeCompare(right.path)),
		collectedAt: new Date().toISOString(),
	});

	await writeJsonFile({ path, value: index });

	return index;
};
