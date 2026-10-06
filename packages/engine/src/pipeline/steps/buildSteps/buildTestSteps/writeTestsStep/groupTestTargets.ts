import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import type ts from 'typescript';
import { defaultPackagesDir } from '#src/common/constants/defaultPackagesDir.ts';
import { chunkFileGroup } from '#src/common/fileGroups/chunkFileGroup.ts';
import { groupConnectedFiles } from '#src/common/fileGroups/groupConnectedFiles.ts';
import { collectImportEdges } from '#src/common/moduleGraph/collectImportEdges/collectImportEdges.ts';
import { isInertSourceFile } from '#src/common/sourceFiles/isInertSourceFile.ts';
import { isTestFile } from '#src/common/sourceFiles/isTestFile.ts';
import type { PipelineRun } from '#src/pipeline/common/PipelineRun.ts';
import { partitionByPackage } from '#src/pipeline/common/partitionByPackage.ts';
import type { TestTargetGroup } from '#src/pipeline/steps/common/types/TestTargetGroup.ts';

/** Pathological guard: an import component above this splits into sorted chunks. */
const maxWriterGroupFiles = 12;

interface Params {
	run: PipelineRun;
	/** Changed files with runtime code to cover (selectTestTargets' targets). */
	targets: string[];
	/** Repo-relative source universe (listSourceFiles output, generated paths excluded). */
	universe: string[];
	compiler: typeof ts | undefined;
}

/**
 * A file with no runtime code is never a place a test executes code through,
 * so it neither links two targets nor is held: a package entry that only
 * re-exports would otherwise put every target in the package in one writer.
 */
const readRuntimeImporters = async ({ run, targets, universe, compiler }: { run: PipelineRun; targets: string[]; universe: string[]; compiler: typeof ts }) => {
	const targetSet = new Set(targets);
	const importersOf = new Map<string, string[]>();
	const inert = new Map<string, boolean>();

	for (const { from, to } of await collectImportEdges({ cwd: run.cwd, files: universe, compiler })) {
		if (!targetSet.has(to) || from === to) {
			continue;
		}

		if (!inert.has(from)) {
			const content = await readFile(join(run.cwd, from), 'utf8').catch(() => undefined);

			inert.set(from, content !== undefined && isInertSourceFile({ path: from, content, compiler }));
		}

		if (!inert.get(from)) {
			importersOf.set(to, [...(importersOf.get(to) ?? []), from]);
		}
	}

	return importersOf;
};

/**
 * One writer per import-graph component of the changed files, so files that
 * call each other are covered by one writer. A changed file and every file
 * that imports it directly count as connected, because a writer may cover a
 * file through any caller, and two writers covering through the same caller
 * would edit the same test. Components never cross packages.
 */
export const groupTestTargets = async ({ run, targets, universe, compiler }: Params): Promise<TestTargetGroup[]> => {
	if (!compiler) {
		return [...targets].sort().map((target) => ({ files: [target], held: [target] }));
	}

	const packagesDir = run.config['packages-dir'] ?? defaultPackagesDir;
	const universeByPackage = partitionByPackage({ files: universe.filter((file) => !isTestFile({ path: file })), packagesDir });
	const targetsByPackage = partitionByPackage({ files: targets, packagesDir });
	const groups: TestTargetGroup[] = [];

	// Deterministic throughout: partitions in sorted key order, chunks and held lists sorted.
	for (const partition of [...targetsByPackage.keys()].sort()) {
		const partitionTargets = [...(targetsByPackage.get(partition) ?? [])].sort();
		// Targets are unioned in: a freshly created file may not have been on
		// disk when the universe was listed, and it must still anchor its edges.
		const partitionUniverse = [...new Set([...(universeByPackage.get(partition) ?? []), ...partitionTargets])].sort();
		const importersOf = await readRuntimeImporters({ run, targets: partitionTargets, universe: partitionUniverse, compiler });
		const importers = [...new Set([...importersOf.values()].flat())];
		const edges = [...importersOf.entries()].flatMap(([target, from]) => from.map((importer) => ({ from: importer, to: target })));

		for (const component of groupConnectedFiles({ files: [...new Set([...partitionTargets, ...importers])], edges })) {
			const componentTargets = component.filter((file) => partitionTargets.includes(file));

			if (componentTargets.length > maxWriterGroupFiles) {
				run.progress(
					`write-tests: import component of ${componentTargets.length} files exceeds the ${maxWriterGroupFiles}-file writer cap — splitting into sorted chunks`,
				);
			}

			// Each chunk holds its own importers, so chunks of one component that
			// share a caller never run at the same time.
			for (const chunk of chunkFileGroup({ files: componentTargets, max: maxWriterGroupFiles })) {
				groups.push({
					files: [...chunk].sort(),
					held: [...new Set([...chunk, ...chunk.flatMap((target) => importersOf.get(target) ?? [])])].sort(),
				});
			}
		}
	}

	return groups;
};
