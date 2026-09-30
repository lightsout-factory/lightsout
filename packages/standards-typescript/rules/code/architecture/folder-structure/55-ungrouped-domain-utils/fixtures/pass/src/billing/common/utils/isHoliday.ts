export const isHoliday = ({ date }: { date: Date }): boolean => date.toISOString().slice(5, 10) === '12-25';
