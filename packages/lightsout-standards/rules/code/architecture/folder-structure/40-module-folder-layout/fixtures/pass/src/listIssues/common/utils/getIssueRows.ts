// Correct: only listIssues uses this, so it goes in the module's common/.
export const getIssueRows = ({ titles }: { titles: string[] }): string[] => titles.map((title, index) => `${index + 1}. ${title}`);
