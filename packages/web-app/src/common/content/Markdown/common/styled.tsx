import { createElement, type ReactNode } from 'react';

interface Params {
	tag: string;
	className: string;
}

export const styled = ({ tag, className }: Params) => {
	const Styled = ({ children }: { children?: ReactNode }) => createElement(tag, { className }, children);

	return Styled;
};
