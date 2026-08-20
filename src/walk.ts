import { toError } from "./async";
import { basename, joinPath } from "./path";
import type { Filter, FilterContext } from "./types";

/** Default number of directories enumerated concurrently. */
export const DEFAULT_CONCURRENCY = 8;

export interface WalkOptions {
	/** Maximum number of directories enumerated at once. Defaults to `8`. */
	concurrency?: number;
	/** Aborts the walk early. Already-collected files are still returned. */
	signal?: AbortSignal;
}

export interface WalkResult {
	/** Files that passed every filter, keyed by full path. */
	files: Map<string, FileSystemFileHandle>;
	/**
	 * Directories that could not be enumerated (revoked permission, removed
	 * mid-walk, …). Their previously known contents should be preserved rather
	 * than reported as deleted.
	 */
	unreadableDirectories: string[];
	/** Errors encountered while walking. The walk itself never rejects. */
	errors: Error[];
}

interface PendingDirectory {
	handle: FileSystemDirectoryHandle;
	path: string;
}

const createContext = (path: string, rootPath: string): FilterContext => ({
	path,
	rootPath,
	relativePath: path === rootPath ? "" : path.slice(rootPath.length + 1),
	name: basename(path),
});

const isAllowed = async (
	filters: readonly Filter[],
	context: FilterContext,
	handle: FileSystemHandle,
): Promise<boolean> => {
	for (const filter of filters) {
		const allowed =
			handle.kind === "file"
				? await filter.shouldIncludeFile(
						context,
						handle as FileSystemFileHandle,
					)
				: await filter.shouldProcessDirectory(
						context,
						handle as FileSystemDirectoryHandle,
					);

		if (allowed === false) {
			return false;
		}
	}

	return true;
};

const byName = (a: FileSystemHandle, b: FileSystemHandle) =>
	a.name < b.name ? -1 : 1;

/**
 * Recursively collects every file inside `rootHandle` that passes `filters`.
 *
 * The walk is breadth-first with a bounded number of directories in flight, and
 * it never rejects: a directory that cannot be read is reported through
 * {@link WalkResult.unreadableDirectories} so callers can tell "gone" apart
 * from "temporarily unreadable".
 */
export const walkDirectory = async (
	rootHandle: FileSystemDirectoryHandle,
	rootPath: string,
	filters: readonly Filter[],
	options: WalkOptions = {},
): Promise<WalkResult> => {
	const files = new Map<string, FileSystemFileHandle>();
	const unreadableDirectories: string[] = [];
	const errors: Error[] = [];
	const pending: PendingDirectory[] = [{ handle: rootHandle, path: rootPath }];

	const visit = async ({ handle, path }: PendingDirectory) => {
		const context = createContext(path, rootPath);

		for (const filter of filters) {
			await filter.onDirectoryEnter?.(context, handle);
		}

		const entries: FileSystemHandle[] = [];

		for await (const entry of handle.values()) {
			entries.push(entry);
		}

		// Browsers do not guarantee an enumeration order; sorting keeps scans
		// reproducible and makes `files` stable between polls.
		entries.sort(byName);

		for (const entry of entries) {
			const childPath = joinPath(path, entry.name);
			const childContext = createContext(childPath, rootPath);

			if (!(await isAllowed(filters, childContext, entry))) {
				continue;
			}

			if (entry.kind === "file") {
				files.set(childPath, entry as FileSystemFileHandle);
			} else {
				pending.push({
					handle: entry as FileSystemDirectoryHandle,
					path: childPath,
				});
			}
		}
	};

	const limit = Math.max(
		1,
		Math.floor(options.concurrency ?? DEFAULT_CONCURRENCY) || 1,
	);
	let running = 0;

	await new Promise<void>((resolve) => {
		const pump = () => {
			while (running < limit && pending.length > 0) {
				if (options.signal?.aborted) {
					break;
				}

				const next = pending.shift() as PendingDirectory;
				running += 1;

				visit(next)
					.catch((error: unknown) => {
						unreadableDirectories.push(next.path);
						errors.push(toError(error));
					})
					.then(() => {
						running -= 1;
						pump();
					});
			}

			if (running === 0) {
				resolve();
			}
		};

		pump();
	});

	return { files, unreadableDirectories, errors };
};
