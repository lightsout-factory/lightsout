import { CleansAsItCodesSection } from '#src/features/home/screens/Home/internal/components/CleansAsItCodesSection/CleansAsItCodesSection.tsx';
import { ClosingSection } from '#src/features/home/screens/Home/internal/components/ClosingSection.tsx';
import { HeroSection } from '#src/features/home/screens/Home/internal/components/HeroSection.tsx';
import { HowItWorksSection } from '#src/features/home/screens/Home/internal/components/HowItWorksSection/HowItWorksSection.tsx';
import { ProofSection } from '#src/features/home/screens/Home/internal/components/ProofSection/ProofSection.tsx';
import { StandardsPacksSection } from '#src/features/home/screens/Home/internal/components/StandardsPacksSection/StandardsPacksSection.tsx';
import { TicketTrailSection } from '#src/features/home/screens/Home/internal/components/TicketTrailSection/TicketTrailSection.tsx';

/** Named rather than keyed on the function, whose name a minified build takes away. */
const sections = [
	{ name: 'hero', Section: HeroSection },
	{ name: 'cleans-as-it-codes', Section: CleansAsItCodesSection },
	{ name: 'standards-packs', Section: StandardsPacksSection },
	{ name: 'how-it-works', Section: HowItWorksSection },
	{ name: 'proof', Section: ProofSection },
	{ name: 'ticket-trail', Section: TicketTrailSection },
	{ name: 'closing', Section: ClosingSection },
];

/**
 * Suspends on nothing, so a build with no repository under it renders: every
 * section reads bundled source, and the pack's live numbers come through a query
 * that is allowed to fail.
 */
export const Home = () => (
	<div className="flex flex-col">
		{sections.map(({ name, Section }) => (
			<Section key={name} />
		))}
	</div>
);
