import { dim } from '#src/cli/internal/common/terminal/dim.ts';
import { yellow } from '#src/cli/internal/common/terminal/yellow.ts';
import { GapOutcome } from '#src/contracts/plan/grade/GapOutcome.ts';
import type { GradedGap } from '#src/contracts/plan/grade/GradedGap.ts';
import { findingLocations } from '#src/plan/common/utils/findingLocations.ts';
import { isBlockingGap } from '#src/plan/common/utils/isBlockingGap.ts';

interface Params {
	gap: GradedGap;
	/** Where the lines go — stdout by default. */
	write?: (line: string) => void;
}

const detailOf = ({ gap }: { gap: GradedGap }) => {
	const lines: Record<GapOutcome, string> = {
		// A needs-a-human gap is where an open memory record arrives, so the
		// re-verification judge's refusal note is printed here or nowhere.
		[GapOutcome.NeedsAHuman]: `   decide: ${gap.humanDecision ?? gap.decision}${gap.options.length > 0 ? ` — options: ${gap.options.join(' / ')}` : ''}${gap.unjudgedReason === undefined ? '' : ` — ${gap.unjudgedReason}`}`,
		[GapOutcome.AgentCanDecide]: `   the agent decides: ${gap.agentDecision ?? ''} — safe because ${gap.safeBecause ?? ''}`,
		[GapOutcome.AlreadyAnswered]: `   already answered at: ${gap.answerAt ?? ''}`,
		[GapOutcome.Unjudged]: `   unjudged, so it blocks: ${gap.unjudgedReason ?? 'no judge settled this finding'}`,
	};

	return lines[gap.outcome];
};

/** A renderer, not a filter: it prints every outcome, and which gaps it is handed is the caller's decision. */
export const printGradedGap = ({ gap, write = console.log }: Params): void => {
	const locations = findingLocations({ observations: gap.observations, phase: gap.phase });
	const marker = isBlockingGap({ gap }) ? yellow('?') : dim('note');

	// The whole-plan documentation checker carries no lens, and an empty `()` would
	// read as a lens the renderer failed to print.
	const source = gap.lens === undefined ? '' : ` ${dim(`(${gap.lens})`)}`;
	// How a human tells a finding the plan has seen before from a fresh one.
	const record = gap.findingId === undefined ? '' : `${dim(gap.findingId)} `;

	write(`${record}${marker} [${gap.area}] ${gap.gap}${source}`);
	write(dim(detailOf({ gap })));

	if (locations.length > 1) {
		write(dim(`   affects ${locations.join(', ')}${gap.sharedDefect === undefined ? '' : ` — one defect: ${gap.sharedDefect}`}`));
	}
};
