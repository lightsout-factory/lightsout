import { describe, expect, jest, test } from '@jest/globals';
import { readTicketAsset } from '#src/ticketTracker/jira/readTicketAsset.ts';
import { jiraTrackerSettingsFixture } from '#tests/helpers/jiraQueueSettingsFixture.ts';

type JiraCallback = (client: { request: (params: unknown) => Promise<unknown> }) => Promise<unknown>;
const mockRunJira = jest.fn<(params: { settings: unknown; request: JiraCallback }) => Promise<unknown>>();

jest.mock('#src/ticketTracker/jira/common/runJira.ts', () => ({ runJira: (params: { settings: unknown; request: JiraCallback }) => mockRunJira(params) }));

const settings = jiraTrackerSettingsFixture();

describe('readTicketAsset', () => {
	test.each([
		'https://evil.example/rest/api/3/attachment/content/17',
		'https://example.atlassian.net.evil.example/rest/api/3/attachment/content/17',
		'https://example.atlassian.net/rest/api/3/issue/LO-54',
	])('refuses to send Jira credentials to an untrusted asset URL: %s', async (url) => {
		expect(await readTicketAsset({ settings, url })).toStrictEqual({
			error: `refusing to send tracker credentials to untrusted attachment URL '${url}'`,
		});
		expect(mockRunJira).not.toHaveBeenCalled();
	});

	test('downloads a trusted attachment through the authenticated Jira client', async () => {
		const request = jest.fn<(params: unknown) => Promise<unknown>>().mockResolvedValue('# plan');
		mockRunJira.mockImplementation(({ request: call }) => call({ request }));

		expect(await readTicketAsset({ settings, url: 'https://example.atlassian.net/rest/api/3/attachment/content/17' })).toBe('# plan');
		expect(request).toHaveBeenCalledWith({ method: 'GET', path: '/rest/api/3/attachment/content/17', response: 'text' });
	});
});
