import { Sparkles } from 'lucide-react';
import { heroDescription } from '#src/home/common/constants/heroDescription.ts';
import { GridPattern } from '#src/home/HomeScreen/common/constants/GridPattern.ts';
import { FadeIn } from '#src/home/HomeScreen/common/FadeIn.tsx';
import { GridBackground } from '#src/home/HomeScreen/common/GridBackground.tsx';
import { InstallLine } from '#src/home/HomeScreen/common/InstallLine.tsx';
import { SectionPill } from '#src/home/HomeScreen/common/SectionPill.tsx';

/**
 * Fills the first screen under the header, so the next section waits below the
 * fold. Styled to FeedbackDrop's hero, class for class.
 */
export const HeroSection = () => (
	<section className="relative flex min-h-[calc(100svh-4.5rem)] w-full flex-col items-center justify-center px-4 py-16 text-center">
		<GridBackground
			pattern={GridPattern.Squares}
			maskImage="linear-gradient(to bottom, black 40%, transparent 100%)"
			className="z-0 opacity-60 dark:opacity-30"
		/>
		<div className="relative z-10 flex flex-col items-center">
			<FadeIn>
				<SectionPill icon={Sparkles} label="lightsout · Quality control for AI coding agents" className="mb-10" />
			</FadeIn>
			<FadeIn delayMs={100}>
				<h1 className="max-w-4xl font-extrabold text-6xl leading-[1.1] tracking-tight md:text-8xl">
					<span className="text-drop-navy">Stop the </span>
					<span className="text-primary">slop.</span>
				</h1>
			</FadeIn>
			<FadeIn delayMs={200}>
				<p className="mt-8 max-w-2xl text-muted-foreground-strong text-lg leading-relaxed md:text-xl">{heroDescription}</p>
			</FadeIn>
			<FadeIn delayMs={300}>
				<InstallLine className="mt-10" />
			</FadeIn>
			<FadeIn delayMs={400}>
				<p className="mt-6 text-muted-foreground text-sm">Alpha · MIT · Works with Claude Code, Codex, and Pi</p>
			</FadeIn>
		</div>
	</section>
);
