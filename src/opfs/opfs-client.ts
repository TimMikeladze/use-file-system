import {
	OpfsDirectoryNotFoundError,
	type OpfsEntry,
	OpfsFileNotFoundError,
	OpfsNotSupportedError,
	type OpfsPath,
	toOpfsPath,
} from "../types";

/**
 * Core OPFS operations - stateless utility functions
 *
 * All paths are relative to the OPFS root. Paths are normalized to always
 * start with "/" and never end with "/" (except for root itself).
 */

/** Check if OPFS is supported in this browser */
export function isOpfsSupported(): boolean {
	return (
		typeof navigator !== "undefined" &&
		"storage" in navigator &&
		"getDirectory" in navigator.storage
	);
}

/** Get the OPFS root directory handle */
export function getOpfsRoot(): Promise<FileSystemDirectoryHandle> {
	if (!isOpfsSupported()) {
		throw new OpfsNotSupportedError();
	}
	return navigator.storage.getDirectory();
}

/**
 * Navigate to a directory handle from a path
 * @param path - Absolute OPFS path (e.g., "/foo/bar")
 * @param options - create: true to create directories that don't exist
 */
export async function getDirectoryHandle(
	path: OpfsPath,
	options?: { create?: boolean },
): Promise<FileSystemDirectoryHandle> {
	const root = await getOpfsRoot();

	if (path === "/" || path === "") {
		return root;
	}

	// Split path into segments, filtering empty strings
	const segments = path.split("/").filter(Boolean);

	let current = root;
	for (const segment of segments) {
		try {
			current = await current.getDirectoryHandle(segment, options);
		} catch (error) {
			if ((error as DOMException).name === "NotFoundError") {
				throw new OpfsDirectoryNotFoundError(path);
			}
			throw error;
		}
	}

	return current;
}

/**
 * Navigate to a file handle from a path
 * @param path - Absolute OPFS path (e.g., "/foo/bar.txt")
 * @param options - create: true to create the file if it doesn't exist
 */
export async function getFileHandle(
	path: OpfsPath,
	options?: { create?: boolean },
): Promise<FileSystemFileHandle> {
	const parentPath = getParentPath(path);
	const fileName = getFileName(path);

	const parent = await getDirectoryHandle(parentPath, options);

	try {
		return await parent.getFileHandle(fileName, options);
	} catch (error) {
		if ((error as DOMException).name === "NotFoundError") {
			throw new OpfsFileNotFoundError(path);
		}
		throw error;
	}
}

/** Read file content as text */
export async function readFile(path: OpfsPath): Promise<string> {
	const handle = await getFileHandle(path);
	const file = await handle.getFile();
	return file.text();
}

/** Read file content as ArrayBuffer */
export async function readFileBuffer(path: OpfsPath): Promise<ArrayBuffer> {
	const handle = await getFileHandle(path);
	const file = await handle.getFile();
	return file.arrayBuffer();
}

/** Write content to a file (creates parent directories if needed) */
export async function writeFile(
	path: OpfsPath,
	content: string | ArrayBuffer,
): Promise<OpfsEntry> {
	const handle = await getFileHandle(path, { create: true });
	const writable = await handle.createWritable();

	try {
		await writable.write(content);
	} finally {
		await writable.close();
	}

	// Return updated metadata
	const file = await handle.getFile();
	return {
		path,
		lastModified: file.lastModified,
		size: file.size,
	};
}

/** Delete a file */
export async function deleteFile(path: OpfsPath): Promise<void> {
	const parentPath = getParentPath(path);
	const fileName = getFileName(path);

	const parent = await getDirectoryHandle(parentPath);
	await parent.removeEntry(fileName);
}

/** Create a directory (and all parent directories) */
export async function createDirectory(path: OpfsPath): Promise<void> {
	await getDirectoryHandle(path, { create: true });
}

/** Delete a directory recursively */
export async function deleteDirectory(path: OpfsPath): Promise<void> {
	const parentPath = getParentPath(path);
	const dirName = getFileName(path);

	const parent = await getDirectoryHandle(parentPath);
	await parent.removeEntry(dirName, { recursive: true });
}

/** Check if a file or directory exists */
export async function exists(path: OpfsPath): Promise<boolean> {
	try {
		// Try as file first
		await getFileHandle(path);
		return true;
	} catch {
		try {
			// Try as directory
			await getDirectoryHandle(path);
			return true;
		} catch {
			return false;
		}
	}
}

/** Get file metadata */
export async function getFileEntry(path: OpfsPath): Promise<OpfsEntry> {
	const handle = await getFileHandle(path);
	const file = await handle.getFile();

	return {
		path,
		lastModified: file.lastModified,
		size: file.size,
	};
}

/**
 * Scan a directory and yield all file entries
 * Uses async generator for memory efficiency with large directories
 */
export async function* scanDirectory(
	basePath: OpfsPath = toOpfsPath("/"),
): AsyncGenerator<OpfsEntry, void, undefined> {
	const stack: { handle: FileSystemDirectoryHandle; path: OpfsPath }[] = [];

	const rootHandle = await getDirectoryHandle(basePath);
	stack.push({ handle: rootHandle, path: basePath });

	while (stack.length > 0) {
		const item = stack.pop();
		if (!item) {
			break;
		}
		const { handle, path } = item;

		for await (const entry of handle.values()) {
			const entryPath = toOpfsPath(
				path === "/" ? `/${entry.name}` : `${path}/${entry.name}`,
			);

			if (entry.kind === "file") {
				const fileHandle = entry as FileSystemFileHandle;
				const file = await fileHandle.getFile();

				yield {
					path: entryPath,
					lastModified: file.lastModified,
					size: file.size,
				};
			} else if (entry.kind === "directory") {
				const dirHandle = entry as FileSystemDirectoryHandle;
				stack.push({ handle: dirHandle, path: entryPath });
			}
		}
	}
}

// ============================================================================
// Path utilities
// ============================================================================

/** Get parent directory path */
function getParentPath(path: OpfsPath): OpfsPath {
	const lastSlash = path.lastIndexOf("/");
	if (lastSlash <= 0) {
		return toOpfsPath("/");
	}
	return toOpfsPath(path.slice(0, lastSlash));
}

/** Get file/directory name from path */
function getFileName(path: OpfsPath): string {
	const lastSlash = path.lastIndexOf("/");
	return path.slice(lastSlash + 1);
}
