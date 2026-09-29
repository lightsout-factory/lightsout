/**
 * The integrity marker both attachment generations commit: the exact file names
 * one publish sent, each with the SHA-256 of the bytes it sent.
 */
export interface AttachmentManifest {
	schemaVersion: 1;
	files: { name: string; sha256: string }[];
}
