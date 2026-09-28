// Incorrect: the only file in formatting/. One function belongs in utils/.
export const formatDate = ({ date }: { date: Date }): string => date.toISOString().slice(0, 10);
