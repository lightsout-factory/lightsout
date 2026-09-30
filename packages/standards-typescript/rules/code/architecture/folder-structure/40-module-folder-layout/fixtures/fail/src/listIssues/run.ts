import { getIssueRows } from './getIssueRows.ts';

// Incorrect: the main file is not named after its folder, so a reader cannot
// tell which file is the module.
export const run = ({ titles }: { titles: string[] }): string => getIssueRows({ titles }).join('\n');
