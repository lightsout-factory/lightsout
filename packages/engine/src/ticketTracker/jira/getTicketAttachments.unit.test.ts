import { describe, expect, jest, test } from '@jest/globals';
import { getTicketAttachments } from '#src/ticketTracker/jira/getTicketAttachments.ts';
import { jiraTrackerSettingsFixture } from '#tests/helpers/jiraQueueSettingsFixture.ts';

type JiraCallback = (client: { request: (params: unknown) => Promise<unknown> }) => Promise<unknown>;
const mockRunJira = jest.fn<(params: { settings: unknown; request: JiraCallback }) => Promise<unknown>>();

jest.mock('#src/ticketTracker/jira/common/runJira.ts', () => ({ runJira: (params: { settings: unknown; request: JiraCallback }) => mockRunJira(params) }));

const settings = jiraTrackerSettingsFixture();

describe('getTicketAttachments', () => {
	test('lists issue attachments with content URLs constructed on the configured Jira origin', async () => {
		const request = jest.fn<(params: unknown) => Promise<unknown>>().mockResolvedValue({
			fields: { attachment: [{ id: '17', filename: 'plan.md', content: 'https://attacker.example/steal' }] },
		});
		mockRunJira.mockImplementation(({ request: call }) => call({ request }));

		expect(await getTicketAttachments({ settings, identifier: 'lo-54' })).toStrictEqual([
			{ id: '17', title: 'plan.md', url: 'https://example.atlassian.net/rest/api/3/attachment/content/17' },
		]);
		expect(request).toHaveBeenCalledWith({ method: 'GET', path: '/rest/api/3/issue/LO-54?fields=attachment', response: 'json' });
	});
});
