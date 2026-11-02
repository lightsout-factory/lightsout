import { CleansAsItCodesSection } from '#src/home/HomeScreen/CleansAsItCodesSection/CleansAsItCodesSection.tsx';
import { ClosingSection } from '#src/home/HomeScreen/ClosingSection.tsx';
import { HeroSection } from '#src/home/HomeScreen/HeroSection.tsx';
import { HowItWorksSection } from '#src/home/HomeScreen/HowItWorksSection/HowItWorksSection.tsx';
import { ProofSection } from '#src/home/HomeScreen/ProofSection/ProofSection.tsx';
import { StandardsPacksSection } from '#src/home/HomeScreen/StandardsPacksSection/StandardsPacksSection.tsx';
import { TicketTrailSection } from '#src/home/HomeScreen/TicketTrailSection/TicketTrailSection.tsx';

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
export const HomeScreen = () => (
	<div className="flex flex-col">
		{sections.map(({ name, Section }) => (
			<Section key={name} />
		))}
	</div>
);
