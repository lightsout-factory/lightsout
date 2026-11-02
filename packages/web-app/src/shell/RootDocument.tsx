import { HeadContent, Scripts } from '@tanstack/react-router';
import type { ReactNode } from 'react';
import { Theme } from '#src/common/constants/Theme.ts';
import { themeStorageKey } from '#src/common/constants/themeStorageKey.ts';

interface Props {
	children: ReactNode;
}

/**
 * The HTML document every route renders into, sent light. The server cannot
 * know this viewer's theme, so an inline script swaps the class before the
 * stylesheet applies to avoid a flash of light. The provider reads the same key
 * in an effect, so there is no hydration mismatch. A browser with storage
 * blocked throws and keeps the server's answer.
 */
export const RootDocument = ({ children }: Props) => {
	const themeScript = `try {
	var stored = localStorage.getItem('${themeStorageKey}');
	if (stored === '${Theme.Dark}') {
		document.documentElement.classList.remove('${Theme.Light}');
		document.documentElement.classList.add('${Theme.Dark}');
	}
} catch (error) { }`;

	return (
		<html lang="en" className={`min-h-full min-w-full ${Theme.Light}`}>
			<head>
				<script>{themeScript}</script>
				<HeadContent />
			</head>
			<body className="min-h-full min-w-full">
				{children}
				<Scripts />
			</body>
		</html>
	);
};
