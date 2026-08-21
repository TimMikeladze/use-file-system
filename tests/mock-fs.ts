/**
 * A small in-memory implementation of the parts of the File System Access API
 * this package uses, so the hook can be exercised without a browser.
 */

export interface MockTree {
	[name: string]: string | MockTree;
}

interface FileNode {
	kind: "file";
	name: string;
	content: string;
	lastModified: number;
}

interface DirectoryNode {
	kind: "directory";
	name: string;
	children: Map<string, Node>;
	/** Makes `values()` reject, simulating a revoked permission. */
	unreadable?: boolean;
}

type Node = FileNode | DirectoryNode;

let clock = 1_700_000_000_000;

const nextTimestamp = () => {
	clock += 1000;
	return clock;
};

const domException = (name: string, message: string) => {
	const error = new Error(message);
	error.name = name;
	return error;
};

const toText = async (
	chunk: string | ArrayBuffer | ArrayBufferView | Blob,
): Promise<string> => {
	if (typeof chunk === "string") {
		return chunk;
	}

	if (chunk instanceof Blob) {
		return await chunk.text();
	}

	if (ArrayBuffer.isView(chunk)) {
		return new TextDecoder().decode(chunk);
	}

	return new TextDecoder().decode(chunk);
};

export class MockFileHandle {
	readonly kind = "file" as const;

	private readonly node: FileNode;

	constructor(node: FileNode) {
		this.node = node;
	}

	get name() {
		return this.node.name;
	}

	isSameEntry(other: unknown) {
		return Promise.resolve(
			other instanceof MockFileHandle && other.node === this.node,
		);
	}

	getFile() {
		return Promise.resolve(
			new File([this.node.content], this.node.name, {
				lastModified: this.node.lastModified,
			}),
		);
	}

	createWritable(options?: { keepExistingData?: boolean }) {
		const node = this.node;
		let buffer = options?.keepExistingData === true ? node.content : "";
		let aborted = false;

		return Promise.resolve({
			async write(chunk: string | ArrayBuffer | ArrayBufferView | Blob) {
				const text = await toText(chunk);
				buffer = text + buffer.slice(text.length);
			},
			close() {
				if (!aborted) {
					node.content = buffer;
					node.lastModified = nextTimestamp();
				}

				return Promise.resolve();
			},
			abort() {
				aborted = true;
				return Promise.resolve();
			},
			seek() {
				return Promise.resolve();
			},
			truncate(size: number) {
				buffer = buffer.slice(0, size);
				return Promise.resolve();
			},
		});
	}
}

export class MockDirectoryHandle {
	readonly kind = "directory" as const;

	private readonly node: DirectoryNode;

	constructor(node: DirectoryNode) {
		this.node = node;
	}

	get name() {
		return this.node.name;
	}

	isSameEntry(other: unknown) {
		return Promise.resolve(
			other instanceof MockDirectoryHandle && other.node === this.node,
		);
	}

	// biome-ignore lint/suspicious/useAwait: async generators model the real API
	async *values(): AsyncGenerator<MockDirectoryHandle | MockFileHandle> {
		if (this.node.unreadable === true) {
			throw domException(
				"NotAllowedError",
				`Permission denied for "${this.node.name}"`,
			);
		}

		for (const child of this.node.children.values()) {
			yield child.kind === "file"
				? new MockFileHandle(child)
				: new MockDirectoryHandle(child);
		}
	}

	getFileHandle(name: string, options?: { create?: boolean }) {
		const existing = this.node.children.get(name);

		if (existing?.kind === "file") {
			return Promise.resolve(new MockFileHandle(existing));
		}

		if (existing) {
			return Promise.reject(
				domException("TypeMismatchError", `"${name}" is a directory`),
			);
		}

		if (options?.create !== true) {
			return Promise.reject(
				domException("NotFoundError", `"${name}" was not found`),
			);
		}

		const node: FileNode = {
			kind: "file",
			name,
			content: "",
			lastModified: nextTimestamp(),
		};

		this.node.children.set(name, node);

		return Promise.resolve(new MockFileHandle(node));
	}

	getDirectoryHandle(name: string, options?: { create?: boolean }) {
		const existing = this.node.children.get(name);

		if (existing?.kind === "directory") {
			return Promise.resolve(new MockDirectoryHandle(existing));
		}

		if (existing) {
			return Promise.reject(
				domException("TypeMismatchError", `"${name}" is a file`),
			);
		}

		if (options?.create !== true) {
			return Promise.reject(
				domException("NotFoundError", `"${name}" was not found`),
			);
		}

		const node: DirectoryNode = {
			kind: "directory",
			name,
			children: new Map(),
		};

		this.node.children.set(name, node);

		return Promise.resolve(new MockDirectoryHandle(node));
	}

	removeEntry(name: string, options?: { recursive?: boolean }) {
		const existing = this.node.children.get(name);

		if (!existing) {
			return Promise.reject(
				domException("NotFoundError", `"${name}" was not found`),
			);
		}

		if (
			existing.kind === "directory" &&
			existing.children.size > 0 &&
			options?.recursive !== true
		) {
			return Promise.reject(
				domException("InvalidModificationError", `"${name}" is not empty`),
			);
		}

		this.node.children.delete(name);

		return Promise.resolve();
	}

	resolve() {
		return Promise.resolve(null);
	}
}

const buildDirectory = (name: string, tree: MockTree): DirectoryNode => {
	const node: DirectoryNode = { kind: "directory", name, children: new Map() };

	for (const [childName, value] of Object.entries(tree)) {
		node.children.set(
			childName,
			typeof value === "string"
				? {
						kind: "file",
						name: childName,
						content: value,
						lastModified: nextTimestamp(),
					}
				: buildDirectory(childName, value),
		);
	}

	return node;
};

/** An in-memory directory plus helpers for mutating it from tests. */
export class MockFileSystem {
	private readonly root: DirectoryNode;

	constructor(name: string, tree: MockTree = {}) {
		this.root = buildDirectory(name, tree);
	}

	/** The root handle, typed as the real API for passing into the hook. */
	get handle(): FileSystemDirectoryHandle {
		return new MockDirectoryHandle(
			this.root,
		) as unknown as FileSystemDirectoryHandle;
	}

	private resolveDirectory(segments: string[], create: boolean) {
		let current = this.root;

		for (const segment of segments) {
			let child = current.children.get(segment);

			if (!child) {
				if (!create) {
					throw new Error(`Missing directory "${segment}"`);
				}

				child = { kind: "directory", name: segment, children: new Map() };
				current.children.set(segment, child);
			}

			if (child.kind !== "directory") {
				throw new Error(`"${segment}" is not a directory`);
			}

			current = child;
		}

		return current;
	}

	/** Creates or overwrites a file, bumping its modification time. */
	write(path: string, content: string) {
		const segments = path.split("/").filter(Boolean);
		const name = segments.pop() as string;
		const directory = this.resolveDirectory(segments, true);
		const existing = directory.children.get(name);

		if (existing?.kind === "file") {
			existing.content = content;
			existing.lastModified = nextTimestamp();
			return;
		}

		directory.children.set(name, {
			kind: "file",
			name,
			content,
			lastModified: nextTimestamp(),
		});
	}

	/** Removes a file or directory. */
	remove(path: string) {
		const segments = path.split("/").filter(Boolean);
		const name = segments.pop() as string;
		this.resolveDirectory(segments, false).children.delete(name);
	}

	/** Makes a directory reject enumeration, simulating a revoked permission. */
	setUnreadable(path: string, unreadable = true) {
		this.resolveDirectory(path.split("/").filter(Boolean), false).unreadable =
			unreadable;
	}

	/** Reads a file's current contents straight from the in-memory tree. */
	read(path: string): string | undefined {
		const segments = path.split("/").filter(Boolean);
		const name = segments.pop() as string;
		const node = this.resolveDirectory(segments, false).children.get(name);

		return node?.kind === "file" ? node.content : undefined;
	}

	/** Every file path in the tree, relative to the root. */
	paths(): string[] {
		const results: string[] = [];

		const visit = (node: DirectoryNode, prefix: string) => {
			for (const child of node.children.values()) {
				const path = prefix ? `${prefix}/${child.name}` : child.name;

				if (child.kind === "file") {
					results.push(path);
				} else {
					visit(child, path);
				}
			}
		};

		visit(this.root, "");

		return results.sort();
	}
}

/** Installs `window.showDirectoryPicker`, returning a cleanup function. */
export const installDirectoryPicker = (
	handle:
		| FileSystemDirectoryHandle
		| (() => Promise<FileSystemDirectoryHandle>),
) => {
	const picker =
		typeof handle === "function" ? handle : () => Promise.resolve(handle);

	Object.defineProperty(window, "showDirectoryPicker", {
		configurable: true,
		writable: true,
		value: picker,
	});

	return () => {
		Reflect.deleteProperty(window, "showDirectoryPicker");
	};
};

/**
 * Installs `navigator.storage.getDirectory`, returning a cleanup function.
 *
 * The handle is deliberately built from a `MockFileSystem` with an empty name
 * and no permission methods, which is exactly what a browser hands back for the
 * origin private file system root.
 */
export const installOpfs = (
	handle:
		| FileSystemDirectoryHandle
		| (() => Promise<FileSystemDirectoryHandle>),
) => {
	const getDirectory =
		typeof handle === "function" ? handle : () => Promise.resolve(handle);
	const previous = Object.getOwnPropertyDescriptor(navigator, "storage");

	Object.defineProperty(navigator, "storage", {
		configurable: true,
		writable: true,
		value: { getDirectory },
	});

	return () => {
		if (previous) {
			Object.defineProperty(navigator, "storage", previous);
		} else {
			Reflect.deleteProperty(navigator, "storage");
		}
	};
};
