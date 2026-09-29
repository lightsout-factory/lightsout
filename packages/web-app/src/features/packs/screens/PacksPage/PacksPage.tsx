import { useSuspenseQuery } from '@tanstack/react-query';
import { PackPageFrame } from '#src/features/packs/components/PackPageFrame.tsx';
import { defaultPackQueryOptions } from '#src/features/packs/queries/defaultPackQueryOptions.ts';
import { CheckKindKey } from '#src/features/packs/screens/PacksPage/internal/components/CheckKindKey.tsx';
import { RuleSetCard } from '#src/features/packs/screens/PacksPage/internal/components/RuleSetCard.tsx';
import { YourPackCard } from '#src/features/packs/screens/PacksPage/internal/components/YourPackCard.tsx';

/**
 * Static by design: read from the copy bundled into the app, so it reads the
 * same on the web as on a machine with a repo open.
 */
export const PacksPage = () => {
	const { data: pack } = useSuspenseQuery(defaultPackQueryOptions());

	return (
		<PackPageFrame>
			<header className="flex flex-col gap-5">
				<h1 className="font-extrabold text-4xl text-drop-navy tracking-tight md:text-5xl">Standards Packs</h1>
				<p className="max-w-2xl text-lg text-muted-foreground leading-relaxed">
					A Standards Pack is the set of rules your agents follow, each enforced by a deterministic check or an agent check.
				</p>
				<CheckKindKey />
			</header>
			<div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
				{pack.channelTotals.map((total) => (
					<RuleSetCard key={total.channel} total={total} />
				))}
				<YourPackCard />
			</div>
		</PackPageFrame>
	);
};
