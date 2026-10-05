import { describe, expect, test } from '@jest/globals';
import { selectListedAttachment } from '#src/common/attachmentManifest/selectListedAttachment.ts';

const setupTicketAttachments = () => {
	const attachments = [
		{ title: 'plan.md', url: 'https://tracker.example/att-1' },
		{ title: 'facts.json', url: 'https://tracker.example/att-2' },
		{ title: 'facts.json', url: 'https://tracker.example/att-3' },
	];

	return { attachments, markerName: '001-search--plan-manifest.json' };
};

describe('selectListedAttachment', () => {
	test('a title the ticket carries once answers that attachment', () => {
		const { attachments, markerName } = setupTicketAttachments();

		const selected = selectListedAttachment({ attachments, name: 'plan.md', markerName });

		expect(selected).toStrictEqual({ attachment: { title: 'plan.md', url: 'https://tracker.example/att-1' } });
	});

	test('a listed title the ticket does not carry is refused, naming the marker that listed it', () => {
		const { attachments, markerName } = setupTicketAttachments();

		const selected = selectListedAttachment({ attachments, name: 'decisions.json', markerName });

		expect(selected).toStrictEqual({
			error: '001-search--plan-manifest.json lists decisions.json, but the ticket carries no attachment with that title',
		});
	});

	test('a listed title the ticket carries twice is refused rather than guessed between', () => {
		const { attachments, markerName } = setupTicketAttachments();

		const selected = selectListedAttachment({ attachments, name: 'facts.json', markerName });

		expect(selected).toStrictEqual({
			error: 'the ticket carries more than one attachment named facts.json, so 001-search--plan-manifest.json cannot select one generation',
		});
	});
});
