import ignore, { type Ignore } from "ignore";
import type { CreateFilter, FilePath, Filter } from "../types";

/**
 * Creates a filter that respects .gitignore rules
 * Reads .gitignore from the root directory during initialization
 */
export const createGitFilter: CreateFilter = async (
	rootHandle,
	_rootPath,
): Promise<Filter> => {
	const ig: Ignore = ignore({ allowRelativePaths: true });

	// Try to read .gitignore from root
	try {
		const gitignoreHandle = await rootHandle.getFileHandle(".gitignore");
		const file = await gitignoreHandle.getFile();
		const content = await file.text();
		ig.add(content);
	} catch {
		// No .gitignore file, that's fine
	}

	return {
		shouldIncludeFile(path: FilePath): boolean {
			// Always exclude .gitignore itself
			if (path.endsWith("/.gitignore") || path === ".gitignore") {
				return false;
			}
			return !ig.ignores(path);
		},

		shouldIncludeDirectory(path: FilePath): boolean {
			// Always exclude .git directory
			if (path.endsWith("/.git") || path === ".git") {
				return false;
			}
			if (path.includes("/.git/")) {
				return false;
			}
			return !ig.ignores(path);
		},
	};
};
