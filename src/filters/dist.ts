import type { CreateFilter, FilePath, Filter } from "../types";

/** Directories to exclude (build outputs, dependencies) */
const EXCLUDED_DIRS = new Set([
	"dist",
	"out",
	"build",
	"vendor",
	"node_modules",
	".next",
	".nuxt",
	".output",
	".vercel",
	".netlify",
	"coverage",
	".cache",
]);

/**
 * Check if a path contains any excluded directory
 */
const isExcluded = (path: FilePath): boolean => {
	const segments = path.split("/");
	return segments.some((segment) => EXCLUDED_DIRS.has(segment));
};

/**
 * Creates a filter that excludes build output and dependency directories
 */
export const createDistFilter: CreateFilter = async (): Promise<Filter> => {
	return {
		shouldIncludeFile(path: FilePath): boolean {
			return !isExcluded(path);
		},

		shouldIncludeDirectory(path: FilePath): boolean {
			// Get the last segment to check if this directory itself is excluded
			const segments = path.split("/");
			const dirName = segments[segments.length - 1];
			if (EXCLUDED_DIRS.has(dirName)) {
				return false;
			}
			return !isExcluded(path);
		},
	};
};
