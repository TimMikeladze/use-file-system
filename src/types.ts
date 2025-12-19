/**
 * File System Access API type declarations
 * These extend the global types since the API isn't fully typed in TypeScript
 */
declare global {
	interface Window {
		showDirectoryPicker?: () => Promise<FileSystemDirectoryHandle>;
	}

	interface FileSystemDirectoryHandle {
		values(): AsyncIterableIterator<FileSystemHandle>;
		getFileHandle(
			name: string,
			options?: { create?: boolean },
		): Promise<FileSystemFileHandle>;
		getDirectoryHandle(
			name: string,
			options?: { create?: boolean },
		): Promise<FileSystemDirectoryHandle>;
		removeEntry(name: string, options?: { recursive?: boolean }): Promise<void>;
	}

	interface FileSystemFileHandle {
		getFile(): Promise<File>;
		createWritable(options?: {
			keepExistingData?: boolean;
		}): Promise<FileSystemWritableFileStream>;
	}

	interface FileSystemWritableFileStream extends WritableStream {
		write(data: string | ArrayBuffer | Blob | DataView): Promise<void>;
		seek(position: number): Promise<void>;
		truncate(size: number): Promise<void>;
		close(): Promise<void>;
	}
}

/** Branded type for file paths - prevents mixing with arbitrary strings */
export type FilePath = string & { readonly __brand: "FilePath" };

/** Helper to create a FilePath from a string */
export const toFilePath = (path: string): FilePath => path as FilePath;

/** File metadata - stored instead of content for lazy loading */
export interface FileEntry {
	path: FilePath;
	handle: FileSystemFileHandle;
	lastModified: number;
	size: number;
}

/** Change event types - discriminated union for type-safe handling */
export type FileChange =
	| { type: "added"; entry: FileEntry }
	| { type: "modified"; entry: FileEntry; previousLastModified: number }
	| { type: "deleted"; path: FilePath };

/**
 * Filter interface for including/excluding files and directories
 * Methods are sync for performance in the hot path
 */
export interface Filter {
	shouldIncludeFile(path: FilePath): boolean;
	shouldIncludeDirectory(path: FilePath): boolean;
}

/**
 * Filter factory function
 * Async because some filters (like git) need to read files during initialization
 */
export type CreateFilter = (
	rootHandle: FileSystemDirectoryHandle,
	rootPath: FilePath,
) => Promise<Filter>;

/** Options for file write operations */
export interface WriteFileOptions {
	/** If true, truncate the file before writing. Default: true */
	truncate?: boolean;
}

/** Hook configuration options */
export interface UseFsOptions {
	/** Filter factories to apply. Defaults to commonFilters (git + dist + misc) */
	filters?: CreateFilter[];
	/** Polling interval in milliseconds. Default: 100 */
	pollInterval?: number;
	/** Callback for background errors (polling failures, etc.) */
	onError?: (error: Error) => void;
	/** Callback when files change */
	onChange?: (changes: FileChange[]) => void;
}

/** Hook return value */
export interface UseFsResult {
	/** Current file entries (metadata only, not content) */
	files: Map<FilePath, FileEntry>;
	/** True while actively scanning directories */
	isScanning: boolean;
	/** True while polling is active */
	isPolling: boolean;
	/** True if File System Access API is supported */
	isSupported: boolean;

	/** Open directory picker and start watching */
	selectDirectory: () => Promise<void>;
	/** Stop watching and clear all state */
	clear: () => void;
	/** Resume polling (after stopPolling was called) */
	startPolling: () => void;
	/** Pause polling without clearing state */
	stopPolling: () => void;

	/** Read file content on-demand (lazy loading) */
	readFile: (path: FilePath) => Promise<string>;
	/** Write content to an existing or new file */
	writeFile: (
		path: FilePath,
		content: string,
		options?: WriteFileOptions,
	) => Promise<void>;
	/** Delete a file */
	deleteFile: (path: FilePath) => Promise<void>;
	/** Create a new file, optionally with initial content */
	createFile: (path: FilePath, content?: string) => Promise<FileEntry>;
}

/** Base error class for use-fs errors */
export class UseFsError extends Error {
	readonly code: string;

	constructor(message: string, code: string) {
		super(message);
		this.name = "UseFsError";
		this.code = code;
	}
}

/** Thrown when a file is not found */
export class FileNotFoundError extends UseFsError {
	constructor(path: FilePath) {
		super(`File not found: ${path}`, "FILE_NOT_FOUND");
		this.name = "FileNotFoundError";
	}
}

/** Thrown when a directory is not found */
export class DirectoryNotFoundError extends UseFsError {
	constructor(path: string) {
		super(`Directory not found: ${path}`, "DIRECTORY_NOT_FOUND");
		this.name = "DirectoryNotFoundError";
	}
}

/** Thrown when file system permission is denied */
export class PermissionDeniedError extends UseFsError {
	constructor(path: string) {
		super(`Permission denied: ${path}`, "PERMISSION_DENIED");
		this.name = "PermissionDeniedError";
	}
}

/** Thrown when the File System Access API is not supported */
export class NotSupportedError extends UseFsError {
	constructor() {
		super(
			"File System Access API is not supported in this browser",
			"NOT_SUPPORTED",
		);
		this.name = "NotSupportedError";
	}
}

// ============================================================================
// OPFS (Origin Private File System) Types
// ============================================================================

/** Branded type for OPFS paths - prevents mixing with user filesystem paths */
export type OpfsPath = string & { readonly __brand: "OpfsPath" };

/** Helper to create an OpfsPath from a string */
export const toOpfsPath = (path: string): OpfsPath => {
	// Normalize path: ensure leading slash, no trailing slash (except root)
	let normalized = path.startsWith("/") ? path : `/${path}`;
	if (normalized.length > 1 && normalized.endsWith("/")) {
		normalized = normalized.slice(0, -1);
	}
	return normalized as OpfsPath;
};

/** OPFS file entry metadata */
export interface OpfsEntry {
	path: OpfsPath;
	lastModified: number;
	size: number;
}

/** OPFS change events - discriminated union for type-safe handling */
export type OpfsChange =
	| { type: "added"; entry: OpfsEntry }
	| { type: "modified"; entry: OpfsEntry; previousLastModified: number }
	| { type: "deleted"; path: OpfsPath };

/** BroadcastChannel message format for cross-tab sync */
export interface OpfsBroadcastMessage {
	type: "changes";
	changes: OpfsChange[];
	source: string; // Tab identifier
}

/** Hook configuration options */
export interface UseOpfsOptions {
	/** Root path for all operations. Default: '/' */
	basePath?: OpfsPath;
	/** Scan directory on mount. Default: false (lazy) */
	scan?: boolean;
	/** Enable cross-tab sync via BroadcastChannel. Default: true */
	broadcast?: boolean;
	/** Channel name for broadcasts. Default: 'use-opfs' */
	channelName?: string;
	/** Called when files change (including from other tabs) */
	onChange?: (changes: OpfsChange[]) => void;
	/** Called on errors */
	onError?: (error: Error) => void;
}

/** Hook return value */
export interface UseOpfsResult {
	/** Current file entries (metadata only, not content) */
	files: Map<OpfsPath, OpfsEntry>;
	/** True while actively scanning directories */
	isScanning: boolean;
	/** True if OPFS is supported */
	isSupported: boolean;
	/** True if connected to broadcast channel */
	isBroadcasting: boolean;

	/** Scan the basePath directory and populate files state */
	scan: () => Promise<void>;
	/** Clear all state */
	clear: () => void;

	/** Read file content */
	readFile: (path: OpfsPath) => Promise<string>;
	/** Read file as ArrayBuffer (for binary data) */
	readFileBuffer: (path: OpfsPath) => Promise<ArrayBuffer>;
	/** Write content to a file (creates if doesn't exist) */
	writeFile: (path: OpfsPath, content: string | ArrayBuffer) => Promise<void>;
	/** Delete a file */
	deleteFile: (path: OpfsPath) => Promise<void>;
	/** Create a directory (recursive) */
	createDirectory: (path: OpfsPath) => Promise<void>;
	/** Delete a directory (recursive) */
	deleteDirectory: (path: OpfsPath) => Promise<void>;
	/** Check if a file or directory exists */
	exists: (path: OpfsPath) => Promise<boolean>;
}

/** Thrown when OPFS is not supported */
export class OpfsNotSupportedError extends UseFsError {
	constructor() {
		super("OPFS is not supported in this browser", "OPFS_NOT_SUPPORTED");
		this.name = "OpfsNotSupportedError";
	}
}

/** Thrown when an OPFS file is not found */
export class OpfsFileNotFoundError extends UseFsError {
	constructor(path: OpfsPath) {
		super(`OPFS file not found: ${path}`, "OPFS_FILE_NOT_FOUND");
		this.name = "OpfsFileNotFoundError";
	}
}

/** Thrown when an OPFS directory is not found */
export class OpfsDirectoryNotFoundError extends UseFsError {
	constructor(path: OpfsPath) {
		super(`OPFS directory not found: ${path}`, "OPFS_DIRECTORY_NOT_FOUND");
		this.name = "OpfsDirectoryNotFoundError";
	}
}
