import { isNotFoundError, mapLimit, toError } from "./async";
import { isAtOrWithin } from "./path";
import type { FileRecord, Filter } from "./types";
import { walkDirectory } from "./walk";

/** Default number of files read concurrently. */
export const DEFAULT_BATCH_SIZE = 50;

export type ScanParams = {
	/** Watched root directories, keyed by the path they are exposed under. */
	directories: ReadonlyMap<string, FileSystemDirectoryHandle>;
	/** Filters to apply, already instantiated for this scan. */
	filters: readonly Filter[];
	/** Result of the previous scan, used for change detection. */
	previous: ReadonlyMap<string, FileRecord>;
	/** Maximum number of files read at once. Defaults to `50`. */
	batchSize?: number;
	/** Maximum number of directories enumerated at once. Defaults to `8`. */
	concurrency?: number;
	/** Called for every non-fatal error encountered during the scan. */
	onError?: (error: Error) => void;
};

export type ScanResult = {
	/** The complete new state of the watched tree. */
	records: Map<string, FileRecord>;
	/** Files seen for the first time, mapped to their contents. */
	added: Map<string, string>;
	/** Files whose contents differ from the previous scan. */
	changed: Map<string, string>;
	/** Files that disappeared, mapped to their last known contents. */
	deleted: Map<string, string>;
};

/** Projects file records down to the `path -> contents` map exposed publicly. */
export const toContentMap = (
	records: ReadonlyMap<string, FileRecord>,
): Map<string, string> => {
	const contents = new Map<string, string>();

	for (const [path, record] of records) {
		contents.set(path, record.content);
	}

	return contents;
};

/**
 * Walks every watched directory and diffs the result against `previous`.
 *
 * Contents are only re-read when a file's `lastModified` timestamp or size
 * changed, so a steady-state poll over a large tree does no content I/O at all.
 *
 * The returned promise never rejects; recoverable problems are surfaced through
 * `onError` and the affected paths keep their last known state.
 */
export const scanDirectories = async (
	params: ScanParams,
): Promise<ScanResult> => {
	const { directories, filters, previous, onError } = params;

	const discovered = new Map<string, FileSystemFileHandle>();
	const unreadableDirectories: string[] = [];

	await Promise.all(
		Array.from(directories, async ([rootPath, handle]) => {
			const result = await walkDirectory(handle, rootPath, filters, {
				concurrency: params.concurrency,
			});

			for (const [path, fileHandle] of result.files) {
				discovered.set(path, fileHandle);
			}

			unreadableDirectories.push(...result.unreadableDirectories);

			for (const error of result.errors) {
				onError?.(error);
			}
		}),
	);

	const records = new Map<string, FileRecord>();
	const added = new Map<string, string>();
	const changed = new Map<string, string>();

	/**
	 * Reads one discovered file, reusing the previous contents when the file's
	 * metadata says it cannot have changed.
	 */
	const readFile = async (path: string, handle: FileSystemFileHandle) => {
		const record = previous.get(path);
		const file = await handle.getFile();

		if (
			record &&
			record.lastModified === file.lastModified &&
			record.size === file.size
		) {
			// Handles are re-created on every enumeration, so keep the fresh one.
			records.set(
				path,
				record.handle === handle ? record : { ...record, handle },
			);
			return;
		}

		const content = await file.text();

		records.set(path, {
			handle,
			content,
			lastModified: file.lastModified,
			size: file.size,
		});

		if (!record) {
			added.set(path, content);
		} else if (record.content !== content) {
			changed.set(path, content);
		}
	};

	await mapLimit(
		Array.from(discovered),
		params.batchSize ?? DEFAULT_BATCH_SIZE,
		async ([path, handle]) => {
			try {
				await readFile(path, handle);
			} catch (error) {
				if (isNotFoundError(error)) {
					// The file was removed between enumeration and reading; letting it
					// fall out of `records` reports it as deleted, which it is.
					return;
				}

				onError?.(toError(error));

				const record = previous.get(path);

				if (record) {
					// Keep the last known good state rather than claiming a deletion we
					// are not sure about.
					records.set(path, record);
				}
			}
		},
	);

	// Anything under a directory we failed to enumerate is unknown, not gone.
	if (unreadableDirectories.length > 0) {
		for (const [path, record] of previous) {
			if (records.has(path)) {
				continue;
			}

			if (
				unreadableDirectories.some((directoryPath) =>
					isAtOrWithin(path, directoryPath),
				)
			) {
				records.set(path, record);
			}
		}
	}

	const deleted = new Map<string, string>();

	for (const [path, record] of previous) {
		if (!records.has(path)) {
			deleted.set(path, record.content);
		}
	}

	return { records, added, changed, deleted };
};
