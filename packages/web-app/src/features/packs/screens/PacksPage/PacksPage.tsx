import { useSuspenseQuery } from '@tanstack/react-query';
import { PackPageFrame } from '#src/features/packs/components/PackPageFrame.tsx';
import { defaultPackQueryOptions } from '#src/features/packs/queries/defaultPackQueryOptions.ts';
import { CheckKindKey } from '#src/features/packs/screens/PacksPage/internal/components/CheckKindKey.tsx';
import { PackCard } from '#src/features/packs/screens/PacksPage/internal/components/PackCard.tsx';
import { YourPackCard } from '#src/features/packs/screens/PacksPage/internal/components/YourPackCard.tsx';

/**
 * Static by design: read from the copy bundled into the app, so it reads the
 * same on the web as on a machine with a repo open.
 */
export const PacksPage = () => {
	const { data: library } = useSuspenseQuery(defaultPackQueryOptions());

	return (
		<PackPageFrame>
			<header className="flex flex-col gap-5">
				<h1 className="font-extrabold text-4xl text-drop-navy tracking-tight md:text-5xl">Standards Packs</h1>
				<p className="max-w-2xl text-lg text-muted-foreground leading-relaxed">
					A Standards Pack is a named selection of a library’s rules, each enforced by a deterministic check or an agent check. Each package uses one.
				</p>
				<CheckKindKey />
			</header>
			<section aria-labelledby="library-title" className="flex flex-col gap-6">
				<div className="flex flex-col gap-2">
					<h2 id="library-title" className="font-bold font-mono text-2xl text-drop-navy">
						{library.name}
					</h2>
					{library.description === undefined ? null : <p className="max-w-2xl text-muted-foreground">{library.description}</p>}
				</div>
				<div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
					{library.packs.map((pack) => (
						<PackCard key={pack.name} library={library.name} pack={pack} />
					))}
					<YourPackCard />
				</div>
			</section>
		</PackPageFrame>
	);
};
