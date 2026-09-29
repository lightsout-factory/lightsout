import { notFound } from '@tanstack/react-router';

type AbsenceError = new (...args: never[]) => Error;

interface Params<TResult> {
	read: () => Promise<TResult>;
	/** The engine errors that mean the address was wrong rather than that something broke. */
	absent: AbsenceError[];
}

/**
 * Maps absence on the server, while the engine's error is still an instance: a
 * class does not survive the server-function wire, so matching it on the other
 * side would mean matching a message.
 */
export const readOrNotFound = async <TResult>({ read, absent }: Params<TResult>): Promise<TResult> => {
	try {
		return await read();
	} catch (error) {
		if (absent.some((Absence) => error instanceof Absence)) {
			throw notFound();
		}

		throw error;
	}
};
