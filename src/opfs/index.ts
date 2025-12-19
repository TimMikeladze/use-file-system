/**
 * OPFS (Origin Private File System) exports
 *
 * Provides React hooks and utilities for working with the browser's
 * private sandboxed filesystem. Unlike the File System Access API,
 * OPFS doesn't require user permission prompts.
 */

// React hook
export { useOpfs } from "./use-opfs";

// Broadcast channel for cross-tab sync
export { OpfsBroadcast } from "./broadcast";

// Core utilities (usable standalone)
export {
	isOpfsSupported,
	getOpfsRoot,
	getDirectoryHandle,
	getFileHandle,
	readFile,
	readFileBuffer,
	writeFile,
	deleteFile,
	createDirectory,
	deleteDirectory,
	exists,
	getFileEntry,
	scanDirectory,
} from "./opfs-client";

// Types re-exported for convenience
export type {
	OpfsPath,
	OpfsEntry,
	OpfsChange,
	OpfsBroadcastMessage,
	UseOpfsOptions,
	UseOpfsResult,
} from "../types";

export {
	toOpfsPath,
	OpfsNotSupportedError,
	OpfsFileNotFoundError,
	OpfsDirectoryNotFoundError,
} from "../types";
