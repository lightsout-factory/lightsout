import { basename } from 'node:path';
import { parsePhaseDeclarations } from '#src/plan/common/parsePhaseDeclarations.ts';
import type { DeliverableFile } from '#src/plan/common/types/DeliverableFile.ts';
import type { PhaseFile } from '#src/plan/common/types/PhaseFile.ts';
import { parsePlan } from '#src/plan/parsePlan/parsePlan.ts';
import { getPhaseConnections } from '#src/plan/runPlanGrade/common/getPhaseGraph/getPhaseConnections.ts';

interface Params {
	files: DeliverableFile[];
	overviewText: string;
}

const parseFiles = ({ files }: { files: DeliverableFile[] }): PhaseFile[] =>
	files.map((file) => {
		const base = basename(file.path);

		return { path: file.path, base, number: Number(/^phase(\d+)-/.exec(base)?.[1] ?? 1), plan: parsePlan({ content: file.text, base }) };
	});

export const getPhaseGraph = ({ files, overviewText }: Params): { connections: Map<string, Set<string>> } | { error: string } =>
	getPhaseConnections({
		phases: parseFiles({ files }),
		declarations: parsePhaseDeclarations({ plan: parsePlan({ content: overviewText, base: 'overview.md' }) }),
	});
