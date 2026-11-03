import { Outlet } from '@tanstack/react-router';
import { SiteHeader } from '#src/layouts/SiteHeader.tsx';

/**
 * The document scrolls rather than an inner column, because a landing page is
 * read top to bottom — the app's frame does the opposite, which is why these are
 * two shells and not one with a flag.
 */
export const SiteLayout = () => (
	<div className="relative min-h-screen w-full">
		<SiteHeader />
		<main>
			<Outlet />
		</main>
	</div>
);
