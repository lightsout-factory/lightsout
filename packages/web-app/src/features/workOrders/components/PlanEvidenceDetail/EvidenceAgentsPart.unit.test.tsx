import { describe, expect, test } from '@jest/globals';
import type { PlanEvidence } from '@lightsout/engine/contracts';
import { render, screen } from '@testing-library/react';
import { EvidenceAgentsPart } from '#src/features/workOrders/components/PlanEvidenceDetail/EvidenceAgentsPart.tsx';

type Agents = NonNullable<PlanEvidence['agents']>;

const commandRunLabel = 'Planning acme-search';

const judgementDetail = 'Sorted ties by name because the plan left their order open.';

const buildAgents = (): Agents => ({
	state: 'finished',
	processes: { value: 11, provenance: 'measured' },
	peakProcesses: { value: 4, provenance: 'measured' },
	byStep: [
		{ step: 'implement', invocations: { value: 2, provenance: 'measured' } },
		{ step: 'refactor', invocations: { value: 7, provenance: 'measured' } },
	],
	timeline: [
		{
			label: commandRunLabel,
			startedAt: '2026-01-01T10:00:00.000Z',
			endedAt: '2026-01-01T10:30:00.000Z',
			outcome: 'passed',
			processes: { value: 6, provenance: 'measured' },
			provenance: 'measured',
		},
	],
	judgementCalls: [{ step: 'test-writers', detail: judgementDetail, provenance: 'reported' }],
});

/** A command run still going: no end and no outcome recorded yet. */
const stillRunning: Agents['timeline'][number] = {
	label: commandRunLabel,
	startedAt: '2026-01-01T11:00:00.000Z',
	processes: { value: 2, provenance: 'measured' },
	provenance: 'measured',
};

const setupEvidenceAgentsPart = ({ agents = buildAgents() }: { agents?: Agents } = {}) => {
	render(<EvidenceAgentsPart agents={agents} />);
};

describe('EvidenceAgentsPart', () => {
	test('shows peak, build agents by step, timeline and judgement calls', () => {
		setupEvidenceAgentsPart();

		const text = document.body.textContent ?? '';

		expect(text).toMatch(/peak\D*4/i);
		expect(text).toMatch(/implement\D*2/);
		expect(text).toMatch(/refactor\D*7/);
		expect(text).toContain(commandRunLabel);
		expect(text).toContain(judgementDetail);
	});

	test("shows only the totals and no judgement calls when nothing ran by step, on the timeline or by an agent's own call", () => {
		setupEvidenceAgentsPart({ agents: { ...buildAgents(), byStep: [], timeline: [], judgementCalls: [] } });

		const text = document.body.textContent ?? '';

		expect({
			totals: /Agent processes\D*11(?!\d)/.test(text),
			calls: /Judgement calls\D*0(?!\d)/.test(text),
			steps: /implement|refactor/.test(text),
			timeline: screen.queryByRole('list', { name: 'Timeline' }),
		}).toStrictEqual({ totals: true, calls: true, steps: false, timeline: null });
	});

	test('reads a command run with no outcome yet as running', () => {
		setupEvidenceAgentsPart({ agents: { ...buildAgents(), timeline: [stillRunning] } });

		const timeline = screen.getByRole('list', { name: 'Timeline' });

		expect(timeline.textContent).toMatch(/running/);
	});
});
