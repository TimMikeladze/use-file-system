/** Small async primitives shared by the scanner and the hook. */

/**
 * Runs `task` over `items` with at most `limit` tasks in flight.
 *
 * Unlike a batched `Promise.all` there is no barrier between groups: as soon as
 * one task settles the next item starts, so a single slow file cannot stall the
 * whole batch.
 */
export const mapLimit = async <T>(
	items: readonly T[],
	limit: number,
	task: (item: T, index: number) => Promise<void>,
): Promise<void> => {
	const size = Math.max(1, Math.floor(limit) || 1);

	if (items.length <= size) {
		await Promise.all(items.map(task));
		return;
	}

	let cursor = 0;

	const worker = async () => {
		while (cursor < items.length) {
			const index = cursor;
			cursor += 1;
			await task(items[index] as T, index);
		}
	};

	await Promise.all(Array.from({ length: size }, worker));
};

/** True for a `DOMException` (or `Error`) with the given `name`. */
export const isErrorWithName = (value: unknown, name: string): boolean =>
	value instanceof Error && value.name === name;

/** True when the user dismissed a picker dialog. */
export const isAbortError = (value: unknown): boolean =>
	isErrorWithName(value, "AbortError");

/** True when a handle no longer resolves to an entry on disk. */
export const isNotFoundError = (value: unknown): boolean =>
	isErrorWithName(value, "NotFoundError");

/** Normalises anything thrown into an `Error`. */
export const toError = (value: unknown): Error => {
	if (value instanceof Error) {
		return value;
	}

	return new Error(typeof value === "string" ? value : JSON.stringify(value));
};
