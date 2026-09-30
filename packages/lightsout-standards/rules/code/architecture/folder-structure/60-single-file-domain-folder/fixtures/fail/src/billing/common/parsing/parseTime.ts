export const parseTime = ({ text }: { text: string }): number => Number(text.split(':')[0]) * 60 + Number(text.split(':')[1]);
