interface Params {
	ms: number;
}

export const sleep = ({ ms }: Params): Promise<void> => new Promise<void>((resolve) => setTimeout(resolve, ms));
