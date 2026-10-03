import { bold } from '#src/cli/internal/common/terminal/bold.ts';
import { dim } from '#src/cli/internal/common/terminal/dim.ts';

interface Params {
	/** What the section is, e.g. `Deterministic checks`. */
	title: string;
	/** How it answers, when the title alone does not say — dim, beside the title. */
	subtitle?: string;
}

export const printSectionHeading = ({ title, subtitle }: Params): void => {
	console.log('');
	console.log(subtitle === undefined ? bold(title) : `${bold(title)}  ${dim('·')}  ${dim(subtitle)}`);
};
