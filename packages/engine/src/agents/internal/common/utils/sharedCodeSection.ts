import type { SharedCodeFolder } from '#src/common/types/SharedCodeFolder.ts';

const groupLine = ({ folder, names }: SharedCodeFolder['groups'][number]) => {
	// Past this many files one folder is counted rather than named: the list would cost more than the search it saves.
	const namesPerFolderCap = 60;
	const label = folder === '' ? '(directly in the folder)' : `${folder}/`;
	const listing = names.length > namesPerFolderCap ? `${names.length} files, too many to list here — search the folder by name` : names.join(', ');

	return `- ${label}: ${listing}`;
};

interface Params {
	/** The `common/` folders visible from where this spawn works, nearest first. Absent or empty = no section. */
	sharedCode?: SharedCodeFolder[];
}

/** One text for every role that carries it, so the implementing agent and the refactoring agent are pointed at the same shared code in the same words. */
export const sharedCodeSection = ({ sharedCode }: Params): string | undefined =>
	sharedCode === undefined || sharedCode.length === 0
		? undefined
		: [
				'# Shared code within reach',
				'Each `common/` folder below serves the folder that holds it: `src/billing/common/` is for the code under `src/billing/`. Before you write a helper, type, constant or service, look for it here by name, and reuse or extend what exists rather than write a second copy. Each name is a file, without its extension. The folders nearest your work come first.',
				...sharedCode.map(({ path, groups }) => [`\`${path}/\``, ...groups.map(groupLine)].join('\n')),
			].join('\n\n');
