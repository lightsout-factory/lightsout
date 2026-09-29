import type { PrismTheme } from 'prism-react-renderer';

export const codeTheme: PrismTheme = {
	plain: { color: 'var(--code-plain)' },
	styles: [
		{ types: ['comment', 'prolog', 'doctype', 'cdata'], style: { color: 'var(--code-comment)', fontStyle: 'italic' } },
		{ types: ['keyword', 'builtin', 'important', 'atrule'], style: { color: 'var(--code-keyword)' } },
		{ types: ['string', 'char', 'attr-value', 'regex', 'template-string'], style: { color: 'var(--code-string)' } },
		{ types: ['number', 'boolean', 'constant', 'symbol'], style: { color: 'var(--code-number)' } },
		{ types: ['function', 'method'], style: { color: 'var(--code-function)' } },
		{ types: ['class-name', 'maybe-class-name', 'tag', 'property'], style: { color: 'var(--code-type)' } },
		{ types: ['punctuation', 'operator'], style: { color: 'var(--code-punctuation)' } },
	],
};
