import { describe, expect, jest, test } from '@jest/globals';
import { attachPreparedFiles } from '#src/common/attachmentManifest/attachPreparedFiles.ts';
import type { TrackerSettings } from '#src/common/types/TrackerSettings.ts';

// Mocked Imports
// -------------------------
type AttachmentWrite = { ticketId: string; title: string; content: Buffer; contentType: string };

const mockSetTicketAttachment = jest.fn<(params: AttachmentWrite) => Promise<{ error: string } | undefined>>();

jest.mock('#src/ticketTracker/setTicketAttachment.ts', () => ({ setTicketAttachment: (params: AttachmentWrite) => mockSetTicketAttachment(params) }));
// -------------------------

const settings: TrackerSettings = { provider: 'linear', ticketPrefix: 'LO', team: 'LO', apiKey: 'lin_key' };

const setupUpload = ({ refusedTitle }: { refusedTitle?: string } = {}) => {
	const progress: string[] = [];
	const writes: AttachmentWrite[] = [];

	mockSetTicketAttachment.mockImplementation(async (write) => {
		writes.push(write);

		return write.title === refusedTitle ? { error: 'the tracker refused the upload' } : undefined;
	});

	const attach = () =>
		attachPreparedFiles({
			settings,
			ticketId: 'id-54',
			ticketRef: 'lo-54',
			attachments: [
				{ name: 'plan.md', content: Buffer.from('# plan\n') },
				{ name: 'facts.json', content: Buffer.from('[]\n') },
				{ name: 'plan-manifest.json', content: Buffer.from('{}\n') },
			],
			onProgress: (message) => progress.push(message),
			titlePrefix: '001-search',
		});

	return { attach, progress, writes };
};

describe('attachPreparedFiles', () => {
	test('every file is attached in order under the plan id, and each one is reported', async () => {
		const { attach, progress } = setupUpload();

		const result = await attach();

		expect(result).toStrictEqual({ published: ['001-search--plan.md', '001-search--facts.json', '001-search--plan-manifest.json'] });
		expect(progress).toStrictEqual([
			'attached 001-search--plan.md to lo-54',
			'attached 001-search--facts.json to lo-54',
			'attached 001-search--plan-manifest.json to lo-54',
		]);
	});

	test('a file is sent to the ticket with the content type its name implies', async () => {
		const { attach, writes } = setupUpload();

		await attach();

		expect(writes.map(({ ticketId, title, contentType }) => ({ ticketId, title, contentType }))).toStrictEqual([
			{ ticketId: 'id-54', title: '001-search--plan.md', contentType: 'text/markdown' },
			{ ticketId: 'id-54', title: '001-search--facts.json', contentType: 'application/json' },
			{ ticketId: 'id-54', title: '001-search--plan-manifest.json', contentType: 'application/json' },
		]);
	});

	test('a refused upload stops the rest and answers what did land beside the refusal', async () => {
		const { attach, writes } = setupUpload({ refusedTitle: '001-search--facts.json' });

		const result = await attach();

		expect(result).toStrictEqual({ published: ['001-search--plan.md'], error: 'the tracker refused the upload' });
		// the file after the refused one is never sent
		expect(writes).toHaveLength(2);
	});
});
