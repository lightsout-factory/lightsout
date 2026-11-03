import type { Theme } from '#src/constants/Theme.ts';

export interface ThemeContextValue {
	theme: Theme;
	setTheme: (theme: Theme) => void;
}
