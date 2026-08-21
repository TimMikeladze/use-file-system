/**
 * Path helpers.
 *
 * Paths used throughout this package are POSIX-style, forward-slash separated
 * and always relative to (and prefixed by) the name of the watched root
 * directory, e.g. `my-project/src/index.ts`. They never start with a slash and
 * never contain `.` or `..` segments.
 */

/** Joins a directory path and an entry name. */
export const joinPath = (directoryPath: string, name: string): string =>
	directoryPath ? `${directoryPath}/${name}` : name;

/** Returns the last segment of a path, e.g. `a/b/c.ts` -> `c.ts`. */
export const basename = (path: string): string => {
	const index = path.lastIndexOf("/");
	return index === -1 ? path : path.slice(index + 1);
};

/** Returns everything but the last segment of a path, e.g. `a/b/c.ts` -> `a/b`. */
export const dirname = (path: string): string => {
	const index = path.lastIndexOf("/");
	return index === -1 ? "" : path.slice(0, index);
};

/** Splits a path into its non-empty segments. */
export const pathSegments = (path: string): string[] =>
	path.split("/").filter((segment) => segment.length > 0);

/** True when `path` is strictly nested inside `directoryPath`. */
export const isWithin = (path: string, directoryPath: string): boolean =>
	directoryPath.length > 0 && path.startsWith(`${directoryPath}/`);

/** True when `path` is `directoryPath` itself or nested inside it. */
export const isAtOrWithin = (path: string, directoryPath: string): boolean =>
	path === directoryPath || isWithin(path, directoryPath);

/**
 * Validates and canonicalises a user supplied path.
 *
 * Collapses repeated slashes, strips leading/trailing slashes and rejects
 * traversal segments so a path can never escape the watched directory it is
 * resolved against.
 *
 * @throws {TypeError} when the path is not a usable, non-empty relative path.
 */
export const normalizePath = (path: string): string => {
	if (typeof path !== "string") {
		throw new TypeError(`Expected a string path, received ${typeof path}`);
	}

	const segments = pathSegments(path);

	if (segments.length === 0) {
		throw new TypeError("Expected a non-empty path");
	}

	if (segments.some((segment) => segment === "." || segment === "..")) {
		throw new TypeError(
			`Path must not contain "." or ".." segments, received "${path}"`,
		);
	}

	return segments.join("/");
};
