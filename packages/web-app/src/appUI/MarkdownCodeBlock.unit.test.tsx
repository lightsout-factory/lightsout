import { describe, expect, test } from '@jest/globals';
import { render, screen } from '@testing-library/react';
import { MarkdownCodeBlock } from '#src/appUI/MarkdownCodeBlock.tsx';

/** A fenced block as `react-markdown` hands it over: one `<code>` element carrying the fence's language. */
const setupCodeBlock = ({ fence, text }: { fence?: string; text: string }) => {
	render(
		<MarkdownCodeBlock>
			<code className={fence === undefined ? undefined : `language-${fence}`}>{text}</code>
		</MarkdownCodeBlock>,
	);
};

describe('MarkdownCodeBlock', () => {
	test('captions the block with its fence language and offers to copy it', () => {
		setupCodeBlock({ fence: 'sh', text: 'pnpm install\n' });

		expect({ caption: screen.getByText('sh'), copy: screen.getByRole('button', { name: 'Copy sh' }) }).toStrictEqual({
			caption: expect.anything(),
			copy: expect.anything(),
		});
	});

	test('captions a `jsonc` fence as json, which is how it is highlighted', () => {
		setupCodeBlock({ fence: 'jsonc', text: '{ "a": 1 }\n' });

		expect(screen.getByRole('button', { name: 'Copy json' })).toBeInTheDocument();
	});

	test('captions a block with no language as text', () => {
		setupCodeBlock({ text: 'plain words\n' });

		expect(screen.getByRole('button', { name: 'Copy text' })).toBeInTheDocument();
	});

	test('shows the block’s text without the newline the fence closes on', () => {
		setupCodeBlock({ fence: 'sh', text: 'pnpm install\n' });

		expect(document.querySelector('pre')?.textContent).toBe('pnpm install');
	});
});
