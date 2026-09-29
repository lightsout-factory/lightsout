import { join } from 'node:path';

interface Params {
	/** The ticket's own folder, as `workOrderFolderDir` names it. */
	workOrderFolder: string;
}

export const getWorkOrderRunsDir = ({ workOrderFolder }: Params): string => join(workOrderFolder, 'runs');
