import type ts from 'typescript';
import { defaultPackagesDir } from '#src/common/constants/defaultPackagesDir.ts';
import { chunkFileGroup } from '#src/common/fileGroups/chunkFileGroup.ts';
import { groupConnectedFiles } from '#src/common/fileGroups/groupConnectedFiles.ts';
import { collectImportEdges } from '#src/common/moduleGraph/collectImportEdges/collectImportEdges.ts';
import type { PipelineRun } from '#src/pipeline/common/PipelineRun.ts';
import { partitionByPackage } from '#src/pipeline/common/partitionByPackage.ts';
import type { TestTargetGroup } from '#src/pipeline/steps/common/types/TestTargetGroup.ts';

/** Pathological guard: an import component above this splits into sorted chunks. */
const maxWriterGroupFiles = 12;

interface Params {
	run: PipelineRun;
	/** Changed files with runtime code to cover (selectTestTargets' targets). */
	targets: string[];
	compiler: typeof ts | undefined;
}

/**
 * One writer per import-graph component of the changed files, so files that
 * call each other are covered by one writer and unrelated files stay
 * parallel. Only edges between changed files count: linking through an
 * unchanged caller would pull unrelated changes into one writer wherever a
 * single file calls many. Components never cross packages.
 */
export const groupTestTargets = async ({ run, targets, compiler }: Params): Promise<TestTargetGroup[]> => {
	if (!compiler) {
		return [...targets].sort().map((target) => ({ files: [target] }));
	}

	const byPackage = partitionByPackage({ files: targets, packagesDir: run.config['packages-dir'] ?? defaultPackagesDir });
	const groups: TestTargetGroup[] = [];

	for (const partition of [...byPackage.keys()].sort()) {
		const partitionTargets = byPackage.get(partition) ?? [];
		const edges = await collectImportEdges({ cwd: run.cwd, files: partitionTargets, compiler });

		for (const component of groupConnectedFiles({ files: partitionTargets, edges })) {
			if (component.length > maxWriterGroupFiles) {
				run.progress(
					`write-tests: import component of ${component.length} files exceeds the ${maxWriterGroupFiles}-file writer cap — splitting into sorted chunks`,
				);
			}

			for (const chunk of chunkFileGroup({ files: component, max: maxWriterGroupFiles })) {
				groups.push({ files: [...chunk].sort() });
			}
		}
	}

	return groups;
};
