import { expect, test } from '@jest/globals';
import { buildFeatureExecutorInvocation } from '#src/agents/buildFeatureExecutorInvocation/buildFeatureExecutorInvocation.ts';

const planContent = '# Plan: add the widget flag\n\nPLAN-SENTINEL';
const allowedCommands = ['pnpm --filter api run prisma:migrate:dev:name'];

const selfCheckCommand = 'node /repo/dist/main.js self-check --run run-42 --cwd "/repo"';

const selfCheckSectionOf = (systemPrompt: string) => systemPrompt.split('\n\n---\n\n').find((section) => section.includes(selfCheckCommand)) ?? '';

const grantedCommandsSectionOf = (systemPrompt: string) => systemPrompt.split('\n\n---\n\n').find((section) => section.startsWith('# Granted commands')) ?? '';

test('carries the self-check section with its command, its stop rule, its three-run cap and its friction instruction', () => {
	const granted = buildFeatureExecutorInvocation({ planContent, allowedCommands, selfCheckCommand });
	const ungranted = buildFeatureExecutorInvocation({ planContent, allowedCommands });
	// the prompt wraps its lines; the sentences are what matter
	const prose = selfCheckSectionOf(granted.systemPrompt).replace(/\s+/g, ' ');

	// the exact command is handed over, so the agent runs the engine's own bundle rather than a repo script
	expect(granted.systemPrompt).toContain(selfCheckCommand);
	// the section rides the cached system prompt, beside the grant it follows
	expect(granted.systemPrompt.indexOf('# Granted commands')).toBeLessThan(granted.systemPrompt.indexOf(selfCheckCommand));
	// what each exit code means
	expect(prose).toMatch(/exits?( with)? 1\b/i);
	expect(prose).toMatch(/exits?( with)? 0\b/i);
	// the loop terminates on a repeat rather than running forever
	expect(prose).toMatch(/identical/i);
	// and it is capped whether or not it repeats itself
	expect(prose).toMatch(/three/i);
	// the engine's own gates stay the only authority
	expect(prose).toMatch(/only verdict/i);
	// a check still red at the last round is reported as friction, not as a failed run
	expect(prose).toMatch(/friction/);
	// a spawn the engine granted no self-check is told nothing about one
	expect(ungranted.systemPrompt).not.toContain(selfCheckCommand);
});

test("exempts the engine's self-check from the granted-commands rule against verifying", () => {
	const { systemPrompt } = buildFeatureExecutorInvocation({ planContent, allowedCommands, selfCheckCommand });
	// the prompt wraps its lines; the sentences are what matter
	const prose = grantedCommandsSectionOf(systemPrompt).replace(/\s+/g, ' ');

	// the consumer's own granted commands are still not for verifying
	expect(prose).toMatch(/never use them to verify/i);
	// but the engine's own self-check is named as the one thing that rule does not cover
	expect(prose).toMatch(/self-check/i);
	// the grant itself is unchanged — one backticked bullet per prefix
	expect(prose).toContain(`- \`${allowedCommands[0]}\``);
});

test("limits self-check repair to the agent's own changed files and sends every other red to friction", () => {
	const { systemPrompt } = buildFeatureExecutorInvocation({ planContent, selfCheckCommand });
	// the prompt wraps its lines; the sentences are what matter
	const prose = selfCheckSectionOf(systemPrompt).replace(/\s+/g, ' ');

	// a package-scoped check can print a red the agent's own change did not cause
	expect(prose).toMatch(/only[^.]*chang/i);
	// every other finding is recorded rather than chased
	expect(prose).toMatch(/friction/);
	// and the agent stops re-running for it, so a pre-existing red cannot burn the cap
	expect(prose).toMatch(/(stop|do not|don't|never)[^.]*re-run/i);
});

test("buildFeatureExecutorInvocation: names the self-check as the engine's own argument-less command, and says when to record rather than re-run", () => {
	const { systemPrompt } = buildFeatureExecutorInvocation({ planContent, selfCheckCommand });
	// the prompt wraps its lines; the sentences are what matter
	const prose = selfCheckSectionOf(systemPrompt).replace(/\s+/g, ' ');

	// whose command it is, so the agent does not look for a repository script
	expect(prose).toMatch(/engine's own command/i);
	// appending an argument cannot widen what it runs, so the agent is told not to try
	expect(prose).toMatch(/takes no arguments/i);
	// a command that will not run at all is skipped rather than retried
	expect(prose).toMatch(/cannot be executed/i);
	// and the two endings that check nothing are recorded, never re-run
	expect(prose).toMatch(/ran nothing/i);
	expect(prose).toMatch(/could not work out what to check/i);
});
