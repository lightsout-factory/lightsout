import { describe, expect, test } from '@jest/globals';
import { render, screen, within } from '@testing-library/react';
import { CircleCheck } from 'lucide-react';
import { IconList } from '#src/components/ui/IconList.tsx';

const setupIconList = ({ items = ['Writes tests', 'Refactors'] }: { items?: string[] } = {}) => {
	render(<IconList items={items} Icon={CircleCheck} className="gap-1" itemClassName="items-start" iconClassName="size-3" />);
};

describe('IconList', () => {
	test('lists every item in the order it was given', () => {
		setupIconList({ items: ['Writes tests', 'Refactors'] });

		const items = screen.getAllByRole('listitem').map((item) => item.textContent);

		expect(items).toStrictEqual(['Writes tests', 'Refactors']);
	});

	test('leads each item with the icon, hidden from assistive technology since the text carries the meaning', () => {
		setupIconList({ items: ['Writes tests'] });

		const icon = within(screen.getByRole('listitem')).getByText('', { selector: 'svg' });

		expect(icon).toHaveAttribute('aria-hidden', 'true');
	});

	test('keeps the icon beside its text, whatever classes the caller adds', () => {
		setupIconList({ items: ['Writes tests'] });

		const item = screen.getByRole('listitem');

		expect({ item: item.className.split(' '), icon: item.querySelector('svg')?.className.baseVal.split(' ') }).toStrictEqual({
			item: ['flex', 'gap-2', 'items-start'],
			icon: expect.arrayContaining(['shrink-0', 'size-3']),
		});
	});
});
