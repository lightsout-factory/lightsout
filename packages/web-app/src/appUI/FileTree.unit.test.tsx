import { describe, expect, test } from '@jest/globals';
import { fireEvent, render, screen } from '@testing-library/react';
import { FileTree } from '#src/appUI/FileTree.tsx';

const files = [
	{ path: 'package.json', content: <p>the manifest</p> },
	{ path: 'src/feature/buildGreeting.ts', content: <p>the dead export</p> },
];

const setupFileTree = ({ defaultPath = 'src/feature/buildGreeting.ts' }: { defaultPath?: string } = {}) => {
	render(<FileTree files={files} defaultPath={defaultPath} label="Incorrect files" />);
};

describe('FileTree', () => {
	test('opens on the file it is told to, not the first in the list', () => {
		setupFileTree();

		const open = screen.getByText('the dead export');

		expect(open).toBeVisible();
	});

	test('opens the first file when the one it is told to is not there', () => {
		setupFileTree({ defaultPath: 'src/gone.ts' });

		const open = screen.getByText('the manifest');

		expect(open).toBeVisible();
	});

	test('makes each file a tab and each folder a label, since nothing opens a folder', () => {
		setupFileTree();

		const tabs = screen.getAllByRole('tab').map((tab) => tab.textContent);

		expect({ tabs, folders: [screen.getByText('src'), screen.getByText('feature')].length }).toStrictEqual({
			tabs: ['package.json', 'buildGreeting.ts'],
			folders: 2,
		});
	});

	test('opens another file when it is chosen', () => {
		setupFileTree();

		fireEvent.mouseDown(screen.getByRole('tab', { name: 'package.json' }));

		expect(screen.getByText('the manifest')).toBeVisible();
	});
});
