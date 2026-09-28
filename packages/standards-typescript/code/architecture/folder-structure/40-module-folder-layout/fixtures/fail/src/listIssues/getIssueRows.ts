// Incorrect: only listIssues uses this, so it belongs in listIssues/common/utils/.
export const getIssueRows = ({ titles }: { titles: string[] }): string[] => titles.map((title, index) => `${index + 1}. ${title}`);
