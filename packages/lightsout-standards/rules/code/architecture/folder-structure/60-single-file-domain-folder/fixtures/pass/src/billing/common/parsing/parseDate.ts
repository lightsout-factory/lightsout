// Correct: parsing/ holds two files, so it is worth a folder.
export const parseDate = ({ text }: { text: string }): Date => new Date(`${text}T00:00:00Z`);
