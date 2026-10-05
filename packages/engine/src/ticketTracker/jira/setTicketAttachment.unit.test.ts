import { describe, expect, jest, test } from '@jest/globals';
import { setTicketAttachment } from '#src/ticketTracker/jira/setTicketAttachment.ts';
import { jiraTrackerSettingsFixture } from '#tests/helpers/jiraQueueSettingsFixture.ts';

type JiraCallback = (client: { request: (params: unknown) => Promise<unknown> }) => Promise<unknown>;
const mockRunJira = jest.fn<(params: { settings: unknown; request: JiraCallback }) => Promise<unknown>>();

jest.mock('#src/ticketTracker/jira/common/runJira.ts', () => ({ runJira: (params: { settings: unknown; request: JiraCallback }) => mockRunJira(params) }));

const settings = jiraTrackerSettingsFixture();

describe('setTicketAttachment', () => {
	test('uploads and links the replacement before deleting captured same-title attachments', async () => {
		const request = jest
			.fn<(params: unknown) => Promise<unknown>>()
			.mockResolvedValueOnce({
				fields: {
					attachment: [
						{ id: 'old-1', filename: 'plan.md' },
						{ id: 'other', filename: 'brainstorm-notes.md' },
					],
				},
			})
			.mockResolvedValueOnce([{ id: 'new-1', filename: 'plan.md' }])
			.mockResolvedValueOnce(undefined);
		mockRunJira.mockImplementation(({ request: call }) => call({ request }));

		expect(
			await setTicketAttachment({ settings, ticketId: '10054', title: 'plan.md', content: Buffer.from('# plan'), contentType: 'text/markdown' }),
		).toBeUndefined();
		expect(request.mock.calls.map(([params]) => (params as { method: string }).method)).toStrictEqual(['GET', 'POST', 'DELETE']);
		expect(request).toHaveBeenNthCalledWith(
			2,
			expect.objectContaining({
				method: 'POST',
				path: '/rest/api/3/issue/10054/attachments',
				headers: { 'X-Atlassian-Token': 'no-check' },
				body: expect.any(FormData),
				response: 'json',
			}),
		);
		expect(request).toHaveBeenNthCalledWith(3, { method: 'DELETE', path: '/rest/api/3/attachment/old-1', response: 'empty' });
	});

	test('keeps the old copy when upload/link does not report the new attachment', async () => {
		const request = jest
			.fn<(params: unknown) => Promise<unknown>>()
			.mockResolvedValueOnce({ fields: { attachment: [{ id: 'old-1', filename: 'plan.md' }] } })
			.mockResolvedValueOnce([]);
		mockRunJira.mockImplementation(({ request: call }) => call({ request }));

		expect(
			await setTicketAttachment({ settings, ticketId: '10054', title: 'plan.md', content: Buffer.from('# plan'), contentType: 'text/markdown' }),
		).toStrictEqual({ error: "Jira accepted the upload for 'plan.md' but did not report a linked attachment" });
		expect(request.mock.calls.map(([params]) => (params as { method: string }).method)).toStrictEqual(['GET', 'POST']);
	});

	test('returns a duplicate-safe cleanup failure after a new copy exists', async () => {
		const request = jest
			.fn<(params: unknown) => Promise<unknown>>()
			.mockResolvedValueOnce({ fields: { attachment: [{ id: 'old-1', filename: 'plan.md' }] } })
			.mockResolvedValueOnce([{ id: 'new-1', filename: 'plan.md' }])
			.mockRejectedValueOnce(new Error('delete denied'));
		mockRunJira.mockImplementation(({ request: call }) => call({ request }));

		expect(
			await setTicketAttachment({ settings, ticketId: '10054', title: 'plan.md', content: Buffer.from('# plan'), contentType: 'text/markdown' }),
		).toStrictEqual({
			error: "Jira linked the new 'plan.md' but could not delete old attachment 'old-1': delete denied; duplicate copies remain",
		});
	});
});
