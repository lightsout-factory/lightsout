import { type ReactNode, useCallback, useEffect, useMemo, useState } from 'react';
import { Theme } from '#src/common/constants/Theme.ts';
import { themeStorageKey } from '#src/common/constants/themeStorageKey.ts';
import { ThemeContext } from '#src/theme/internal/ThemeContext.ts';

const readStoredTheme = () => {
	let stored: Theme | undefined;

	try {
		const raw = localStorage.getItem(themeStorageKey);

		if (raw === Theme.Light || raw === Theme.Dark) {
			stored = raw;
		}
	} catch {
		// Storage blocked: the default stands rather than throwing into the render tree.
	}

	return stored;
};

const writeStoredTheme = ({ theme }: { theme: Theme }) => {
	try {
		localStorage.setItem(themeStorageKey, theme);
	} catch {
		// Storage blocked: the choice still applies to this page, it just will not survive a reload.
	}
};

interface Props {
	children: ReactNode;
	defaultTheme?: Theme;
}

/**
 * Every DOM and storage touch happens in an effect, and the stored choice is
 * read on mount rather than in `useState`'s initialiser, so the first client
 * render matches the server's and hydration does not trip.
 */
export const ThemeProvider = ({ children, defaultTheme = Theme.Light }: Props) => {
	const [theme, setStoredTheme] = useState<Theme>(defaultTheme);

	useEffect(() => {
		const stored = readStoredTheme();

		if (stored !== undefined) {
			setStoredTheme(stored);
		}
	}, []);

	useEffect(() => {
		const element = document.documentElement;

		element.classList.remove(Theme.Light, Theme.Dark);
		element.classList.add(theme);
	}, [theme]);

	const setTheme = useCallback((next: Theme) => {
		setStoredTheme(next);
		writeStoredTheme({ theme: next });
	}, []);

	const value = useMemo(() => ({ theme, setTheme }), [theme, setTheme]);

	return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
};
