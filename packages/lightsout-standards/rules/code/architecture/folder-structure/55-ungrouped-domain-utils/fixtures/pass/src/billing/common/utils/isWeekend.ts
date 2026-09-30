// Correct: two is* functions share a kind, not a subject, so they stay in utils/.
export const isWeekend = ({ date }: { date: Date }): boolean => date.getDay() === 0 || date.getDay() === 6;
