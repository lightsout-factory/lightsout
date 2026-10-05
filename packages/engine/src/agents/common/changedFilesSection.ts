interface Params {
	/** The files created or modified earlier in this run, absent on a spawn that is the run's first attempt. */
	changedFiles?: string[];
}

export const changedFilesSection = ({ changedFiles }: Params): string | undefined =>
	changedFiles === undefined || changedFiles.length === 0
		? undefined
		: `# Previously changed files\n\nFiles already created or modified earlier in this run:\n\n${changedFiles.map((file) => `- ${file}`).join('\n')}`;
