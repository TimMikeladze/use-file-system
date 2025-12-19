/**
 * Worker-specific OPFS utilities
 *
 * These exports are ONLY usable in Web Worker contexts.
 * They provide synchronous file access for high-performance workloads.
 */
export {
	isSyncAccessSupported,
	openSync,
	readSync,
	readSyncAt,
	writeSync,
	appendSync,
	truncateSync,
	getSizeSync,
	flushSync,
	closeSync,
	readTextSync,
	writeTextSync,
} from "./sync-access";
