import { describe, expect, test } from '@jest/globals';
import { render, screen } from '@testing-library/react';
import { Theme } from '#src/constants/Theme.ts';
import { useTheme } from '#src/hooks/useTheme.ts';
import { ThemeProvider } from '#src/providers/ThemeProvider.tsx';

const ThemeReadout = () => {
	const { theme } = useTheme();

	return <p>theme: {theme}</p>;
};

const setupUseTheme = () => {
	localStorage.clear();
	render(
		<ThemeProvider defaultTheme={Theme.Light}>
			<ThemeReadout />
		</ThemeProvider>,
	);
};

/** The same reader with no provider above it — the mistake the hook exists to name. */
const setupUnwrappedReader = () => {
	localStorage.clear();

	return { renderReadout: () => render(<ThemeReadout />) };
};

describe('useTheme', () => {
	test('hands back the theme in force', () => {
		setupUseTheme();

		const readout = screen.getByText('theme: light');

		expect(readout).toBeInTheDocument();
	});

	test('says so rather than handing back a silently wrong theme outside a provider', () => {
		const { renderReadout } = setupUnwrappedReader();

		expect(renderReadout).toThrow('useTheme must be used within a ThemeProvider');
	});
});
