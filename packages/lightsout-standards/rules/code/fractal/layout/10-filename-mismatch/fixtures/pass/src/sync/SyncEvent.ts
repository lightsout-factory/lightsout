export interface FileAddedEvent {
	kind: 'file-added';
}

export interface RecordParsedEvent {
	kind: 'record-parsed';
}

export type SyncEvent = FileAddedEvent | RecordParsedEvent;
