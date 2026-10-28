import { describe, expect, test } from '@jest/globals';
import { render, screen } from '@testing-library/react';
import type { ComponentType, ReactNode } from 'react';
import { articleComponents } from '#src/appUI/markdownArticleComponents.tsx';

describe('articleComponents', () => {
	test('wraps a table in a frame that scrolls on its own rather than widening the page', () => {
		const Table = articleComponents.table as ComponentType<{ children?: ReactNode }>;

		render(
			<Table>
				<tbody>
					<tr>
						<td>harness</td>
					</tr>
				</tbody>
			</Table>,
		);

		expect(screen.getByRole('table').parentElement?.className).toContain('overflow-x-auto');
	});

	test('gives second- and third-level headings an anchor that lands below the sticky site header', () => {
		const Heading = articleComponents.h2 as ComponentType<{ children?: ReactNode }>;

		render(<Heading>Minimal setup</Heading>);

		const heading = screen.getByRole('heading', { level: 2 });

		expect({ id: heading.id, landsBelowHeader: heading.className.includes('scroll-mt-24') }).toStrictEqual({ id: 'minimal-setup', landsBelowHeader: true });
	});
});
