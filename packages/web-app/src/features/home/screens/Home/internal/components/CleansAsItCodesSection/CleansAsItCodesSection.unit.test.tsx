import { afterEach, describe, expect, jest, test } from '@jest/globals';
import { act, fireEvent, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { CleansAsItCodesSection } from '#src/features/home/screens/Home/internal/components/CleansAsItCodesSection/CleansAsItCodesSection.tsx';
import { codeCaps } from '#src/features/home/screens/Home/internal/components/CleansAsItCodesSection/internal/common/constants/codeCaps.ts';
import { getDefaultPackBundle } from '#src/lightsout/common/utils/getDefaultPackBundle.ts';

// Mocked Imports
// -------------------------
// Only the link, which needs a live router around it to resolve a path.
jest.mock('@tanstack/react-router', () => ({
	Link: ({ to, params, children, className }: { to: string; params?: Record<string, string>; children: ReactNode; className?: string }) => (
		<a href={Object.entries(params ?? {}).reduce((path, [name, value]) => path.replace(`$${name}`, value), to)} className={className}>
			{children}
		</a>
	),
}));
// -------------------------

/** How long one frame of the folder scene holds, and how many frames it plays before the next tab opens. */
const folderStepMs = 900;
const folderFrameCount = 10;

const setupSection = ({ prefersReduced = false }: { prefersReduced?: boolean } = {}) => {
	jest.useFakeTimers();

	if (prefersReduced) {
		Object.assign(globalThis, { matchMedia: () => ({ matches: true }) });
	}

	render(<CleansAsItCodesSection />);

	// One act per frame: each frame's report has to land before the next timer
	// is set, just as it does in a browser.
	const waitFrames = ({ count }: { count: number }) => {
		for (let frame = 0; frame < count; frame += 1) {
			act(() => jest.advanceTimersByTime(folderStepMs));
		}
	};

	return { waitFrames };
};

/** The benefit whose tab is open, by its title. */
const readOpenBenefit = () => screen.getByRole('tab', { selected: true }).querySelector('.font-bold')?.textContent;

/** A default-pack rule's shipped settings. */
const readPackSettings = ({ rule }: { rule: string }) => getDefaultPackBundle().rules.find((entry) => entry.id === rule)?.defaultSettings;

afterEach(() => {
	jest.useRealTimers();
	Reflect.deleteProperty(globalThis, 'matchMedia');
});

describe('CleansAsItCodesSection', () => {
	test('states what lightsout does to a codebase, in one line', () => {
		setupSection();

		expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent('Lightsout cleans as it codes.');
	});

	test('shows three things, the folder cap first', () => {
		setupSection();

		const titles = screen.getAllByRole('tab').map((tab) => tab.querySelector('.font-bold')?.textContent);

		expect(titles).toStrictEqual(['Keeps folders easy to navigate', 'Keeps files focused', 'Keeps code DRY']);
	});

	test('says where each one actually happens, by its real name, since a reader who installs will check', () => {
		setupSection();

		const sources = Array.from(document.querySelectorAll('code[data-source-kind]'), (code) => code.parentElement?.textContent);

		expect(sources).toStrictEqual(['Standards Pack/folder-size', 'Standards Pack/file-size', 'Planning/duplicate check']);
	});

	test('keeps the first benefit open until its scene has played its last frame', () => {
		const { waitFrames } = setupSection();

		waitFrames({ count: folderFrameCount - 1 });

		expect(readOpenBenefit()).toBe('Keeps folders easy to navigate');
	});

	test('opens the next benefit as the scene finishes, not on a clock of its own', () => {
		const { waitFrames } = setupSection();

		waitFrames({ count: folderFrameCount });

		expect(readOpenBenefit()).toBe('Keeps files focused');
	});

	test('stops moving on once the reader picks one, so the reader is in charge', () => {
		const { waitFrames } = setupSection();

		fireEvent.mouseDown(screen.getByRole('tab', { name: /Keeps code DRY/ }));
		waitFrames({ count: folderFrameCount * 3 });

		expect(readOpenBenefit()).toBe('Keeps code DRY');
	});

	test('does not cycle at all for a reader who asked for less motion', () => {
		const { waitFrames } = setupSection({ prefersReduced: true });

		waitFrames({ count: folderFrameCount * 3 });

		expect(readOpenBenefit()).toBe('Keeps folders easy to navigate');
	});

	test('names only rules the default Standards Pack actually ships', () => {
		setupSection();

		const shown = Array.from(document.querySelectorAll('code[data-source-kind="standards-pack"]'), (code) => code.textContent);
		const shipped = new Set(getDefaultPackBundle().rules.map((rule) => rule.id));

		expect(shown).toStrictEqual(['folder-size', 'file-size']);
		expect(shown.filter((rule) => !shipped.has(rule ?? ''))).toStrictEqual([]);
	});

	test('quotes the caps the default Standards Pack actually ships, so tuning the pack fails here until the page follows', () => {
		expect(codeCaps).toStrictEqual({
			folderFiles: readPackSettings({ rule: 'folder-size' })?.cap,
			fileLines: readPackSettings({ rule: 'file-size' })?.file,
		});
	});

	test('closes by saying the cards are a sample, in words that hold however many rules the pack ships', () => {
		setupSection();

		expect(screen.getByRole('link', { name: 'See them all' }).parentElement).toHaveTextContent(
			'These are just a few of the rules in the default Standards Pack.',
		);
	});

	test('sends the reader to the Standards Packs to see the rest', () => {
		setupSection();

		expect(screen.getByRole('link', { name: 'See them all' })).toHaveAttribute('href', '/standards-packs');
	});
});
