import { describe, expect, test } from '@jest/globals';
import { render, screen } from '@testing-library/react';
import { CodeBlock } from '#src/appUI/CodeBlock.tsx';

const setupCodeBlock = ({ text = 'const label = read();\nconst other = read();', path = 'src/readLabel.ts', isCaptionHidden = false } = {}) => {
	const { container } = render(<CodeBlock text={text} path={path} isCaptionHidden={isCaptionHidden} action={<button type="button">Copy</button>} />);

	return { container };
};

describe('CodeBlock', () => {
	test('shows the file verbatim, line for line', () => {
		const { container } = setupCodeBlock();

		const text = container.querySelector('pre')?.textContent;

		expect(text).toBe('const label = read();const other = read();');
	});

	test('names the file above the code, with the action beside it', () => {
		setupCodeBlock();

		expect([screen.getByText('src/readLabel.ts'), screen.getByRole('button', { name: 'Copy' })]).toHaveLength(2);
	});

	test('leaves the caption off when the path is already shown elsewhere', () => {
		setupCodeBlock({ isCaptionHidden: true });

		const caption = screen.queryByText('src/readLabel.ts');

		expect(caption).not.toBeInTheDocument();
	});

	test('colours a file whose extension has a grammar', () => {
		const { container } = setupCodeBlock();

		const keyword = [...container.querySelectorAll('pre span')].find((span) => span.textContent === 'const');

		expect(keyword).toHaveClass('keyword');
	});

	test('shows a file with no grammar as plain text rather than failing', () => {
		const { container } = setupCodeBlock({ text: 'plain words', path: 'notes.txt' });

		const text = container.querySelector('pre')?.textContent;

		expect(text).toBe('plain words');
	});
});
