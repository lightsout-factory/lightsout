import { describe, expect, test } from '@jest/globals';
import { render, screen } from '@testing-library/react';
import { DocToc } from '#src/features/docs/components/DocToc.tsx';

describe('DocToc', () => {
	test('links each second- and third-level heading to its anchor, leaving the title out', () => {
		render(<DocToc text={'# Configuration\n\n## Gates\n\nwords\n\n### The check gate\n'} />);

		const links = screen.getAllByRole('link').map((link) => ({ text: link.textContent, href: link.getAttribute('href') }));

		expect(links).toStrictEqual([
			{ text: 'Gates', href: '#gates' },
			{ text: 'The check gate', href: '#the-check-gate' },
		]);
	});

	test('renders nothing for a document with no headings to list', () => {
		const { container } = render(<DocToc text={'# Configuration\n\njust words\n'} />);

		expect(container).toBeEmptyDOMElement();
	});
});
