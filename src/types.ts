/**
 * Public types plus the small amount of File System Access API surface that is
 * still missing from TypeScript's DOM lib.
 *
 * These are declared locally rather than as `declare global` augmentations so
 * consuming projects don't inherit types for APIs their build may not target.
 */

/** Access level requested for a directory handle. */
export type FileSystemAccessMode = "read" | "readwrite";

/** Well known starting locations accepted by `showDirectoryPicker`. */
export type WellKnownDirectory =
	| "desktop"
	| "documents"
	| "downloads"
	| "music"
	| "pictures"
	| "videos";

/** Options accepted by `window.showDirectoryPicker`. */
export interface DirectoryPickerOptions {
	/** Groups picker invocations so the browser remembers the last location. */
	id?: string;
	/** Access level to request up front. Defaults to the hook's `mode`. */
	mode?: FileSystemAccessMode;
	/** Directory the picker should open in. */
	startIn?: FileSystemHandle | WellKnownDirectory;
}

/** Signature of `window.showDirectoryPicker`. */
export type DirectoryPicker = (
	options?: DirectoryPickerOptions,
) => Promise<FileSystemDirectoryHandle>;

type WindowWithDirectoryPicker = Window & {
	showDirectoryPicker?: DirectoryPicker;
};

type PermissionAwareHandle = FileSystemHandle & {
	queryPermission?: (descriptor?: {
		mode?: FileSystemAccessMode;
	}) => Promise<PermissionState>;
	requestPermission?: (descriptor?: {
		mode?: FileSystemAccessMode;
	}) => Promise<PermissionState>;
};

/**
 * Returns `window.showDirectoryPicker` bound to `window`, or `null` when the
 * API is unavailable (unsupported browser, or a server render where there is no
 * `window` at all).
 */
export const getDirectoryPicker = (): DirectoryPicker | null => {
	if (typeof window === "undefined") {
		return null;
	}

	const picker = (window as WindowWithDirectoryPicker).showDirectoryPicker;

	return typeof picker === "function" ? picker.bind(window) : null;
};

/** True when the current environment implements the File System Access API. */
export const isFileSystemAccessSupported = (): boolean =>
	getDirectoryPicker() !== null;

/**
 * Ensures `handle` has been granted `mode` access, prompting the user when
 * necessary.
 *
 * Browsers only allow the prompt from within a user gesture, so call this from
 * an event handler. Environments without the permission API (older browsers,
 * test doubles) are treated as already granted.
 */
export const ensurePermission = async (
	handle: FileSystemHandle,
	mode: FileSystemAccessMode,
): Promise<boolean> => {
	const permissionAware = handle as PermissionAwareHandle;

	if (typeof permissionAware.queryPermission !== "function") {
		return true;
	}

	if ((await permissionAware.queryPermission({ mode })) === "granted") {
		return true;
	}

	if (typeof permissionAware.requestPermission !== "function") {
		return false;
	}

	return (await permissionAware.requestPermission({ mode })) === "granted";
};

/** Contextual information handed to every filter callback. */
export interface FilterContext {
	/** Full path including the watched root, e.g. `my-project/src/index.ts`. */
	path: string;
	/** Path of the watched root directory, e.g. `my-project`. */
	rootPath: string;
	/** Path relative to the watched root, e.g. `src/index.ts`. */
	relativePath: string;
	/** Name of the entry, e.g. `index.ts`. */
	name: string;
}

/**
 * Decides which entries of a watched directory are visible to the hook.
 *
 * Predicates may be synchronous or asynchronous. Returning `false` from
 * `shouldProcessDirectory` prunes the entire subtree, which is what keeps
 * directories such as `node_modules` from ever being enumerated.
 */
export interface Filter {
	/**
	 * Invoked once per directory *before* any of its entries are tested,
	 * including before the directory's own children are recursed into. Use it to
	 * load per-directory configuration such as a `.gitignore`.
	 */
	onDirectoryEnter?: (
		context: FilterContext,
		handle: FileSystemDirectoryHandle,
	) => void | Promise<void>;
	shouldIncludeFile: (
		context: FilterContext,
		handle: FileSystemFileHandle,
	) => boolean | Promise<boolean>;
	shouldProcessDirectory: (
		context: FilterContext,
		handle: FileSystemDirectoryHandle,
	) => boolean | Promise<boolean>;
}

/**
 * Factory for a {@link Filter}.
 *
 * A fresh filter is built for every scan so filters may keep per-scan state
 * (the `.gitignore` filter relies on this).
 */
export type FilterFn = () => Filter | Promise<Filter>;

/** Options for {@link UseFileSystemResult.writeFile}. */
export interface FileWriteOptions {
	/**
	 * Create the file (and any missing parent directories) when it does not
	 * exist. Defaults to `true`.
	 */
	create?: boolean;
	/**
	 * Replace the file's contents entirely. Defaults to `true`.
	 *
	 * When `false` the existing bytes are kept and `data` is written over them
	 * starting at offset `0`, which leaves any trailing bytes in place.
	 */
	truncate?: boolean;
}

/** Data accepted by the write helpers. */
export type WritableFileData = string | ArrayBuffer | ArrayBufferView | Blob;

/** Callback signature for the file lifecycle events. */
export type FilesChangeHandler = (
	files: Map<string, string>,
	previousFiles: Map<string, string>,
) => void;

/** Everything known about a watched file. */
export interface FileRecord {
	handle: FileSystemFileHandle;
	content: string;
	lastModified: number;
	size: number;
}
