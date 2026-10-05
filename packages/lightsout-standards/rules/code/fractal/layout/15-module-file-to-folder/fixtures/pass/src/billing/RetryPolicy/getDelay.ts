export const getDelay = ({ attempt }: { attempt: number }): number => 100 * 2 ** attempt;
