interface Params {
	token: string;
}

export const isPathToken = ({ token }: Params): boolean => token.includes('/') && /\.[A-Za-z0-9]+$/.test(token);
