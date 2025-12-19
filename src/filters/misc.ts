import type { CreateFilter, FilePath, Filter } from "../types";

/** File patterns to exclude (OS files, editor swap files, etc.) */
const EXCLUDED_PATTERNS = [
	".DS_Store",
	".crswap",
	"Thumbs.db",
	"desktop.ini",
	".swp",
	".swo",
	"~",
];

/**
 * Check if a file matches any excluded pattern
 */
const isExcluded = (path: FilePath): boolean => {
	const fileName = path.split("/").pop() || "";
	return EXCLUDED_PATTERNS.some(
		(pattern) => fileName === pattern || fileName.endsWith(pattern),
	);
};

/**
 * Creates a filter that excludes miscellaneous OS and editor files
 */
export const createMiscFilter: CreateFilter = async (): Promise<Filter> => {
	return {
		shouldIncludeFile(path: FilePath): boolean {
			return !isExcluded(path);
		},

		shouldIncludeDirectory(_path: FilePath): boolean {
			// Misc filter doesn't exclude directories
			return true;
		},
	};
};
