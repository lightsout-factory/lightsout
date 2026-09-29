import { Moon, Sun } from 'lucide-react';
import { Button } from '#src/appUI/buttons/Button.tsx';
import { Theme } from '#src/common/constants/Theme.ts';
import { useTheme } from '#src/theme/useTheme.ts';

/**
 * The accessible name says which theme a press selects, not which is in force,
 * so a screen-reader user knows what pressing it does.
 */
export const ThemeToggle = () => {
	const { theme, setTheme } = useTheme();
	const isDark = theme === Theme.Dark;
	const Icon = isDark ? Moon : Sun;

	return (
		<Button
			type="button"
			variant="ghost"
			size="icon"
			aria-label={isDark ? 'Switch to light theme' : 'Switch to dark theme'}
			onClick={() => setTheme(isDark ? Theme.Light : Theme.Dark)}
		>
			<Icon className="size-4" />
		</Button>
	);
};
