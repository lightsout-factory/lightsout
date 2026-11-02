export const GridPattern = { Lines: 'lines', Squares: 'squares' } as const;

export type GridPattern = (typeof GridPattern)[keyof typeof GridPattern];
