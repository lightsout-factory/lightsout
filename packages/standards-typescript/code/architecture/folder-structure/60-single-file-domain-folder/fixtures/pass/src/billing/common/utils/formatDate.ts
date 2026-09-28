// Correct: one function about formatting, so it stays in utils/.
export const formatDate = ({ date }: { date: Date }): string => date.toISOString().slice(0, 10);
