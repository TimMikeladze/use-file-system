import type { FileChange, FileEntry, FilePath, Filter } from "./types";
import { toFilePath } from "./types";

/**
 * Single-pass directory scanner implemented as an async generator
 * Yields FileEntry objects as they are discovered, enabling streaming updates
 *
 * Uses iterative approach with explicit stack instead of recursion
 * to avoid stack overflow on deep directory structures
 */
export async function* scanDirectory(
	rootHandle: FileSystemDirectoryHandle,
	rootPath: FilePath,
	filter: Filter,
): AsyncGenerator<FileEntry, void, undefined> {
	// Stack of directories to process (iterative DFS)
	const stack: Array<{
		handle: FileSystemDirectoryHandle;
		path: FilePath;
	}> = [{ handle: rootHandle, path: rootPath }];

	while (stack.length > 0) {
		const current = stack.pop();
		if (!current) {
			continue;
		}

		const { handle, path } = current;

		try {
			for await (const entry of handle.values()) {
				const entryPath = toFilePath(`${path}/${entry.name}`);

				if (entry.kind === "file") {
					const fileHandle = entry as FileSystemFileHandle;
					// Check filter before doing expensive file operations
					if (filter.shouldIncludeFile(entryPath)) {
						try {
							const file = await fileHandle.getFile();
							yield {
								path: entryPath,
								handle: fileHandle,
								lastModified: file.lastModified,
								size: file.size,
							};
						} catch {
							// File may have been deleted between discovery and read
							// Skip silently - it will be detected as deleted on next poll
						}
					}
				} else if (entry.kind === "directory") {
					// Check filter before recursing
					if (filter.shouldIncludeDirectory(entryPath)) {
						stack.push({
							handle: entry as FileSystemDirectoryHandle,
							path: entryPath,
						});
					}
				}
			}
		} catch {
			// Directory may have been deleted or permission revoked
			// Skip silently and continue with remaining directories
		}
	}
}

/**
 * Collect all entries from scanner into a Map
 * Useful when you need the complete snapshot before processing
 */
export async function collectEntries(
	scanner: AsyncGenerator<FileEntry>,
): Promise<Map<FilePath, FileEntry>> {
	const entries = new Map<FilePath, FileEntry>();
	for await (const entry of scanner) {
		entries.set(entry.path, entry);
	}
	return entries;
}

/**
 * Detect changes between two file snapshots
 * Uses lastModified timestamp for change detection (fast, no content reads)
 *
 * @param previous - Previous snapshot
 * @param current - Current snapshot
 * @returns Array of changes (added, modified, deleted)
 */
export function detectChanges(
	previous: Map<FilePath, FileEntry>,
	current: Map<FilePath, FileEntry>,
): FileChange[] {
	const changes: FileChange[] = [];

	// Detect added and modified files
	for (const [path, entry] of current) {
		const prevEntry = previous.get(path);

		if (!prevEntry) {
			// File was added
			changes.push({ type: "added", entry });
		} else if (prevEntry.lastModified !== entry.lastModified) {
			// File was modified (timestamp changed)
			changes.push({
				type: "modified",
				entry,
				previousLastModified: prevEntry.lastModified,
			});
		}
		// If timestamps match, file is unchanged - skip
	}

	// Detect deleted files
	for (const path of previous.keys()) {
		if (!current.has(path)) {
			changes.push({ type: "deleted", path });
		}
	}

	return changes;
}

/**
 * Merge changes into existing entries map
 * Mutates the entries map in place for efficiency
 */
export function applyChanges(
	entries: Map<FilePath, FileEntry>,
	changes: FileChange[],
): void {
	for (const change of changes) {
		switch (change.type) {
			case "added":
			case "modified":
				entries.set(change.entry.path, change.entry);
				break;
			case "deleted":
				entries.delete(change.path);
				break;
			default: {
				// Exhaustive check - TypeScript will error if a case is missing
				const _exhaustive: never = change;
				throw new Error(`Unknown change type: ${_exhaustive}`);
			}
		}
	}
}
