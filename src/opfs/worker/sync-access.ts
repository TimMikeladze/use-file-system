/**
 * Synchronous OPFS access utilities for Web Workers
 *
 * OPFS provides a unique capability: synchronous file access via
 * FileSystemSyncAccessHandle. This is ONLY available in Web Workers,
 * not the main thread, and offers significantly better performance
 * for high-throughput file operations.
 *
 * Use cases:
 * - Database-like workloads (SQLite in the browser)
 * - Large file processing
 * - Streaming writes without awaiting each chunk
 *
 * @example
 * // In a Web Worker:
 * import { openSync, readSync, writeSync, closeSync } from 'use-fs/opfs/worker';
 *
 * const handle = await openSync('/data.bin');
 * const data = readSync(handle);
 * writeSync(handle, new Uint8Array([1, 2, 3]));
 * closeSync(handle);
 */

import { OpfsNotSupportedError, type OpfsPath } from "../../types";

/** Extended interface for sync access (only available in Workers) */
interface FileSystemSyncAccessHandle {
	read(buffer: ArrayBufferView, options?: { at?: number }): number;
	write(buffer: ArrayBufferView, options?: { at?: number }): number;
	truncate(size: number): void;
	getSize(): number;
	flush(): void;
	close(): void;
}

interface FileSystemFileHandleWithSync extends FileSystemFileHandle {
	createSyncAccessHandle(): Promise<FileSystemSyncAccessHandle>;
}

/** Check if sync access is available (Worker context only) */
export function isSyncAccessSupported(): boolean {
	// Sync access is only available in Workers
	return (
		typeof self !== "undefined" &&
		typeof (self as unknown as { document?: unknown }).document ===
			"undefined" &&
		typeof navigator !== "undefined" &&
		"storage" in navigator
	);
}

/** Get OPFS root in Worker context */
function getOpfsRoot(): Promise<FileSystemDirectoryHandle> {
	if (!isSyncAccessSupported()) {
		throw new OpfsNotSupportedError();
	}
	return navigator.storage.getDirectory();
}

/** Navigate to a file handle */
async function getFileHandle(
	path: OpfsPath,
	options?: { create?: boolean },
): Promise<FileSystemFileHandleWithSync> {
	const root = await getOpfsRoot();

	const segments = path.split("/").filter(Boolean);
	const fileName = segments.pop();

	if (!fileName) {
		throw new Error("Invalid path: no filename");
	}

	let current = root;
	for (const segment of segments) {
		current = await current.getDirectoryHandle(segment, options);
	}

	return current.getFileHandle(
		fileName,
		options,
	) as Promise<FileSystemFileHandleWithSync>;
}

/**
 * Open a file for synchronous access
 * @returns FileSystemSyncAccessHandle for sync operations
 */
export async function openSync(
	path: OpfsPath,
	options?: { create?: boolean },
): Promise<FileSystemSyncAccessHandle> {
	const handle = await getFileHandle(path, options);
	return handle.createSyncAccessHandle();
}

/**
 * Read entire file synchronously
 * @param handle - Sync access handle from openSync
 * @returns File contents as Uint8Array
 */
export function readSync(handle: FileSystemSyncAccessHandle): Uint8Array {
	const size = handle.getSize();
	const buffer = new Uint8Array(size);
	handle.read(buffer, { at: 0 });
	return buffer;
}

/**
 * Read a portion of file synchronously
 * @param handle - Sync access handle from openSync
 * @param offset - Position to start reading
 * @param length - Number of bytes to read
 */
export function readSyncAt(
	handle: FileSystemSyncAccessHandle,
	offset: number,
	length: number,
): Uint8Array {
	const buffer = new Uint8Array(length);
	const bytesRead = handle.read(buffer, { at: offset });
	return buffer.subarray(0, bytesRead);
}

/**
 * Write data synchronously
 * @param handle - Sync access handle from openSync
 * @param data - Data to write
 * @param offset - Position to write at (default: 0)
 * @returns Number of bytes written
 */
export function writeSync(
	handle: FileSystemSyncAccessHandle,
	data: Uint8Array,
	offset = 0,
): number {
	return handle.write(data, { at: offset });
}

/**
 * Append data to file synchronously
 * @param handle - Sync access handle from openSync
 * @param data - Data to append
 * @returns Number of bytes written
 */
export function appendSync(
	handle: FileSystemSyncAccessHandle,
	data: Uint8Array,
): number {
	const size = handle.getSize();
	return handle.write(data, { at: size });
}

/**
 * Truncate file to specified size
 * @param handle - Sync access handle from openSync
 * @param size - New file size
 */
export function truncateSync(
	handle: FileSystemSyncAccessHandle,
	size: number,
): void {
	handle.truncate(size);
}

/**
 * Get file size synchronously
 * @param handle - Sync access handle from openSync
 */
export function getSizeSync(handle: FileSystemSyncAccessHandle): number {
	return handle.getSize();
}

/**
 * Flush pending writes to disk
 * @param handle - Sync access handle from openSync
 */
export function flushSync(handle: FileSystemSyncAccessHandle): void {
	handle.flush();
}

/**
 * Close sync access handle
 * @param handle - Sync access handle from openSync
 */
export function closeSync(handle: FileSystemSyncAccessHandle): void {
	handle.close();
}

/**
 * Helper: Read entire file as text synchronously
 */
export async function readTextSync(path: OpfsPath): Promise<string> {
	const handle = await openSync(path);
	try {
		const data = readSync(handle);
		return new TextDecoder().decode(data);
	} finally {
		closeSync(handle);
	}
}

/**
 * Helper: Write text to file synchronously
 */
export async function writeTextSync(
	path: OpfsPath,
	text: string,
): Promise<void> {
	const handle = await openSync(path, { create: true });
	try {
		const data = new TextEncoder().encode(text);
		handle.truncate(0);
		writeSync(handle, data);
		flushSync(handle);
	} finally {
		closeSync(handle);
	}
}
