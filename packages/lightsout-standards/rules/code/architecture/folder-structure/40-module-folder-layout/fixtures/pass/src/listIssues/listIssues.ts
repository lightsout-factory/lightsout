import { getIssueRows } from './common/utils/getIssueRows.ts';

// Correct: the main file is named after its folder.
export const listIssues = ({ titles }: { titles: string[] }): string => getIssueRows({ titles }).join('\n');
