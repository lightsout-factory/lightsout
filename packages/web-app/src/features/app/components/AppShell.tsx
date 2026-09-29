import { Outlet } from '@tanstack/react-router';
import { TopNav } from '#src/features/app/components/TopNav.tsx';
import { ZoneNav } from '#src/features/app/components/ZoneNav.tsx';

/**
 * The main column is its own scroll container rather than the document, so a
 * wide table scrolls inside the page instead of pushing the layout sideways.
 */
export const AppShell = () => (
	<div className="flex h-screen min-h-0 w-full flex-col">
		<TopNav />
		<div className="flex min-h-0 flex-1 flex-col lg:flex-row">
			<ZoneNav />
			<main className="min-w-0 flex-1 overflow-y-auto">
				<Outlet />
			</main>
		</div>
	</div>
);
