import { useContext } from 'react';
import { ThemeContext } from '#src/theme/common/ThemeContext.ts';
import type { ThemeContextValue } from '#src/theme/common/types/ThemeContextValue.ts';

/**
 * @throws {Error} When called outside a `ThemeProvider`.
 */
export const useTheme = (): ThemeContextValue => {
	const value = useContext(ThemeContext);

	if (value === null) {
		throw new Error('useTheme must be used within a ThemeProvider');
	}

	return value;
};
