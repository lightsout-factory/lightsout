/** Which way a path is mapped through a plan's moves: from a move's source to its destination, or back. */
export const MoveDirection = {
	Forward: 'forward',
	Back: 'back',
} as const;

export type MoveDirection = (typeof MoveDirection)[keyof typeof MoveDirection];
