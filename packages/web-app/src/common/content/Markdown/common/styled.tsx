import { createElement, type ReactNode } from 'react';

export const styled = ({ tag, className }: { tag: string; className: string }) => {
	const Styled = ({ children }: { children?: ReactNode }) => createElement(tag, { className }, children);

	return Styled;
};
