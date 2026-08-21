/**
 * Origin private file system (OPFS) support.
 *
 * OPFS hands back the same `FileSystemDirectoryHandle` the directory picker
 * does, backed by a private store scoped to the origin instead of a folder on
 * disk. Nothing about it is user visible: there is no picker, no permission
 * prompt and no user gesture requirement, and it works in every browser that
 * ships the File System Access API's handle interfaces - including Safari and
 * Firefox, which have no directory picker at all.
 *
 * Everything else in this package is handle-generic, so an OPFS handle walks,
 * scans and writes exactly like a picked directory.
 */

import { normalizePath, pathSegments } from "./path";

/** Path an OPFS mount is exposed under when none is given. */
export const DEFAULT_OPFS_PATH = "opfs";

type NavigatorWithStorage = Navigator & {
	storage?: {
		getDirectory?: () => Promise<FileSystemDirectoryHandle>;
	};
};

const getStorageManager = () => {
	if (typeof navigator === "undefined") {
		return null;
	}

	const { storage } = navigator as NavigatorWithStorage;

	return typeof storage?.getDirectory === "function" ? storage : null;
};

/**
 * True when the current environment implements the origin private file system.
 *
 * Independent of {@link isFileSystemAccessSupported}: Safari and Firefox
 * implement OPFS without implementing `showDirectoryPicker`.
 */
export const isOpfsSupported = (): boolean => getStorageManager() !== null;

/** Options shared by every OPFS entry point. */
export interface OpfsMountOptions {
	/**
	 * Subdirectory of the OPFS root to use, e.g. `"notes"` or `"notes/2026"`.
	 *
	 * Strongly recommended. The OPFS root is shared by everything on the origin -
	 * SQLite WASM journals, Emscripten scratch files, other libraries - and
	 * mounting it whole means walking all of that on every poll.
	 */
	name?: string;
	/** Create the subdirectory when it does not exist. Defaults to `true`. */
	create?: boolean;
}

/**
 * Resolves the origin private file system root, or a subdirectory of it.
 *
 * @throws {Error} when the browser has no OPFS.
 * @throws {DOMException} `NotFoundError` when `create` is `false` and the
 *   subdirectory does not exist.
 */
export const getOpfsRoot = async (
	options: OpfsMountOptions = {},
): Promise<FileSystemDirectoryHandle> => {
	const storage = getStorageManager();

	if (!storage?.getDirectory) {
		throw new Error(
			"The origin private file system is not available in this browser.",
		);
	}

	let handle = await storage.getDirectory();

	if (options.name === undefined) {
		return handle;
	}

	const create = options.create !== false;

	for (const segment of pathSegments(normalizePath(options.name))) {
		handle = await handle.getDirectoryHandle(segment, { create });
	}

	return handle;
};
