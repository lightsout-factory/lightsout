import type { Theme } from '#src/common/constants/Theme.ts';

export interface ThemeContextValue {
	theme: Theme;
	setTheme: (theme: Theme) => void;
}
