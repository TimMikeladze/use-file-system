/**
 * IndexedDB utilities for persisting FileSystemDirectoryHandle across tabs
 *
 * FileSystemDirectoryHandle can be stored in IndexedDB and retrieved by other tabs.
 * However, the retrieved handle may need permission re-verification via requestPermission().
 */

const DB_NAME = "use-fs";
const DB_VERSION = 1;
const STORE_NAME = "handles";

interface StoredHandle {
	key: string;
	handle: FileSystemDirectoryHandle;
	storedAt: number;
}

/**
 * Open the IndexedDB database, creating the object store if needed
 */
function openDatabase(): Promise<IDBDatabase> {
	return new Promise((resolve, reject) => {
		const request = indexedDB.open(DB_NAME, DB_VERSION);

		request.onerror = () => reject(request.error);
		request.onsuccess = () => resolve(request.result);

		request.onupgradeneeded = (event) => {
			const db = (event.target as IDBOpenDBRequest).result;
			if (!db.objectStoreNames.contains(STORE_NAME)) {
				db.createObjectStore(STORE_NAME, { keyPath: "key" });
			}
		};
	});
}

/**
 * Store a FileSystemDirectoryHandle in IndexedDB
 */
export async function storeHandle(
	handle: FileSystemDirectoryHandle,
	key = "default",
): Promise<void> {
	const db = await openDatabase();

	return new Promise((resolve, reject) => {
		const tx = db.transaction(STORE_NAME, "readwrite");
		const store = tx.objectStore(STORE_NAME);

		const data: StoredHandle = {
			key,
			handle,
			storedAt: Date.now(),
		};

		const request = store.put(data);
		request.onerror = () => reject(request.error);
		request.onsuccess = () => resolve();

		tx.oncomplete = () => db.close();
	});
}

/**
 * Retrieve a FileSystemDirectoryHandle from IndexedDB
 * Returns null if no handle is stored
 */
export async function retrieveHandle(
	key = "default",
): Promise<FileSystemDirectoryHandle | null> {
	const db = await openDatabase();

	return new Promise((resolve, reject) => {
		const tx = db.transaction(STORE_NAME, "readonly");
		const store = tx.objectStore(STORE_NAME);

		const request = store.get(key);
		request.onerror = () => reject(request.error);
		request.onsuccess = () => {
			const data = request.result as StoredHandle | undefined;
			resolve(data?.handle ?? null);
		};

		tx.oncomplete = () => db.close();
	});
}

/**
 * Remove a stored handle from IndexedDB
 */
export async function removeHandle(key = "default"): Promise<void> {
	const db = await openDatabase();

	return new Promise((resolve, reject) => {
		const tx = db.transaction(STORE_NAME, "readwrite");
		const store = tx.objectStore(STORE_NAME);

		const request = store.delete(key);
		request.onerror = () => reject(request.error);
		request.onsuccess = () => resolve();

		tx.oncomplete = () => db.close();
	});
}

/**
 * Verify permission for a handle retrieved from IndexedDB
 * Returns true if permission is granted, false otherwise
 *
 * Note: This may show a permission prompt to the user
 */
export async function verifyPermission(
	handle: FileSystemDirectoryHandle,
	mode: "read" | "readwrite" = "readwrite",
): Promise<boolean> {
	// Check if we already have permission
	const options = { mode } as FileSystemHandlePermissionDescriptor;

	// queryPermission and requestPermission may not be available in all browsers
	if ("queryPermission" in handle) {
		const status = await (
			handle as FileSystemDirectoryHandle & {
				queryPermission: (
					opts: FileSystemHandlePermissionDescriptor,
				) => Promise<PermissionState>;
			}
		).queryPermission(options);

		if (status === "granted") {
			return true;
		}
	}

	// Request permission if not already granted
	if ("requestPermission" in handle) {
		const status = await (
			handle as FileSystemDirectoryHandle & {
				requestPermission: (
					opts: FileSystemHandlePermissionDescriptor,
				) => Promise<PermissionState>;
			}
		).requestPermission(options);

		return status === "granted";
	}

	// If neither method is available, assume we have permission
	// (the operation will fail if we don't)
	return true;
}

// Type for permission descriptor (not in lib.dom.d.ts)
interface FileSystemHandlePermissionDescriptor {
	mode?: "read" | "readwrite";
}
