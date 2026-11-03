import { useSuspenseQuery } from '@tanstack/react-query';
import { SitePageFrame } from '#src/components/site/SitePageFrame.tsx';
import { CheckKindKey } from '#src/features/packs/components/CheckKindKey.tsx';
import { PackCard } from '#src/features/packs/components/PackCard/PackCard.tsx';
import { YourPackCard } from '#src/features/packs/components/YourPackCard.tsx';
import { sortPacksForDisplay } from '#src/features/packs/utils/sortPacksForDisplay.ts';
import { defaultPackQueryOptions } from '#src/queries/defaultPackQueryOptions.ts';

/**
 * Static by design: read from the copy bundled into the app, so it reads the
 * same on the web as on a machine with a repo open.
 */
export const PacksScreen = () => {
	const { data: library } = useSuspenseQuery(defaultPackQueryOptions());

	return (
		<SitePageFrame>
			<header className="flex flex-col gap-5">
				<h1 className="font-extrabold text-4xl text-drop-navy tracking-tight md:text-5xl">Standards Packs</h1>
				<p className="max-w-2xl text-lg text-muted-foreground leading-relaxed">
					A Standards Pack is a named selection of a library’s rules, each enforced by a deterministic check or an agent check. Each package uses one.
				</p>
				<CheckKindKey />
			</header>
			<section aria-label="Packs" className="flex flex-col gap-6">
				<h2 className="font-bold font-mono text-2xl text-drop-navy">{library.name}</h2>
				<div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
					{sortPacksForDisplay({ packs: library.packs }).map((pack) => (
						<PackCard key={pack.name} library={library.name} pack={pack} />
					))}
					<YourPackCard />
				</div>
			</section>
		</SitePageFrame>
	);
};
