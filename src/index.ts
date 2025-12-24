// Main hook
export { useFileSystem, useFs } from "./use-file-system";

// Types
export type {
	CreateFilter,
	FileChange,
	FileEntry,
	FilePath,
	Filter,
	UseFsOptions,
	UseFsResult,
	WriteFileOptions,
} from "./types";

// Errors
export {
	DirectoryNotFoundError,
	FileNotFoundError,
	NotSupportedError,
	PermissionDeniedError,
	UseFsError,
} from "./types";

// Utilities
export { toFilePath } from "./types";

// Filters
export {
	combineFilters,
	createDistFilter,
	createGitFilter,
	createMiscFilter,
	defaultFilters,
} from "./filters";

// Scanner utilities (for advanced use cases)
export { collectEntries, detectChanges, scanDirectory } from "./scanner";

// Cross-tab sync utilities
export { FsBroadcast } from "./broadcast";
export type { FsBroadcastMessage } from "./broadcast";
export {
	storeHandle,
	retrieveHandle,
	removeHandle,
	verifyPermission,
} from "./handle-storage";

// ============================================================================
// OPFS (Origin Private File System)
// ============================================================================

// OPFS React hook
export { useOpfs } from "./opfs";

// OPFS utilities
export {
	OpfsBroadcast,
	isOpfsSupported,
	getOpfsRoot,
	getDirectoryHandle,
	getFileHandle,
	readFile as opfsReadFile,
	readFileBuffer as opfsReadFileBuffer,
	writeFile as opfsWriteFile,
	deleteFile as opfsDeleteFile,
	createDirectory,
	deleteDirectory,
	exists as opfsExists,
	getFileEntry,
	scanDirectory as opfsScanDirectory,
} from "./opfs";

// OPFS types
export type {
	OpfsPath,
	OpfsEntry,
	OpfsChange,
	OpfsBroadcastMessage,
	UseOpfsOptions,
	UseOpfsResult,
} from "./types";

// OPFS errors and utilities
export {
	toOpfsPath,
	OpfsNotSupportedError,
	OpfsFileNotFoundError,
	OpfsDirectoryNotFoundError,
} from "./types";
