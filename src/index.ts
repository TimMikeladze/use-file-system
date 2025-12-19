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
