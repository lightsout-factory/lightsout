export const isWeekend = ({ date }: { date: Date }): boolean => date.getDay() === 0 || date.getDay() === 6;
