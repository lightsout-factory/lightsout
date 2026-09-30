import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { messageOf } from '#src/common/utils/messageOf.ts';
import { StandardsPackFile } from '#src/contracts/StandardsPackFile.ts';
import type { LoadedStandardsPackFile } from '#src/standardsLibraries/common/types/LoadedStandardsPackFile.ts';
import { formatSchemaIssues } from '#src/standardsLibraries/internal/common/utils/formatSchemaIssues.ts';

interface Params {
	/** Absolute `<library>/packs` folder. */
	folderPath: string;
	/** The loader throws these as one batch. */
	problems: string[];
}

const parsePackFile = async ({ folderPath, name, problems }: { folderPath: string; name: string; problems: string[] }) => {
	const fileName = `${name}.json`;
	const filePath = `packs/${fileName}`;
	let pack: LoadedStandardsPackFile | undefined;

	try {
		const parsed = StandardsPackFile.safeParse(JSON.parse(await readFile(join(folderPath, fileName), 'utf8')));

		if (parsed.success) {
			const { description, include, 'rule-settings': ruleSettings } = parsed.data;

			pack = {
				name,
				filePath,
				description,
				include: { packs: include?.packs ?? [], topics: include?.topics ?? [], rules: include?.rules ?? [] },
				ruleSettings: ruleSettings ?? {},
			};
		} else {
			problems.push(`${filePath}: ${formatSchemaIssues({ issues: parsed.error.issues, subject: 'pack file' })}`);
		}
	} catch (error) {
		problems.push(`${filePath}: ${messageOf({ error })}`);
	}

	return pack;
};

/**
 * A library may define rules and ship no packs, so a missing folder is no
 * problem. Only `.json` files are packs: anything else an editor or operating
 * system leaves there is skipped, and a pack address is one level deep, so a
 * folder is never read. A bad file yields no pack and one problem, and never
 * stops its siblings.
 */
export const parsePackFolder = async ({ folderPath, problems }: Params): Promise<LoadedStandardsPackFile[]> => {
	const entries = await readdir(folderPath, { withFileTypes: true }).catch(() => []);
	// Sorted by stem, not file name: `.` sorts after `-`, so `node-app.json` would
	// otherwise come before `node.json`.
	const names = entries
		.filter((entry) => entry.isFile() && entry.name.endsWith('.json'))
		.map((entry) => entry.name.slice(0, -'.json'.length))
		.sort();
	const packs: LoadedStandardsPackFile[] = [];

	for (const name of names) {
		const pack = await parsePackFile({ folderPath, name, problems });

		if (pack !== undefined) {
			packs.push(pack);
		}
	}

	return packs;
};
