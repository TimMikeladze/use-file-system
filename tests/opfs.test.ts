import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { getOpfsRoot, isOpfsSupported } from "../src/opfs";
import type { UseFileSystemOptions } from "../src/useFileSystem";
import { useFs } from "../src/useFileSystem";
import { installDirectoryPicker, installOpfs, MockFileSystem } from "./mock-fs";

const NOT_AVAILABLE = /not available/;
const NEEDS_A_PATH = /needs an explicit `path`/;
const NOT_FOUND = /was not found/;

const cleanups: (() => void)[] = [];

afterEach(() => {
	while (cleanups.length > 0) {
		cleanups.pop()?.();
	}

	vi.restoreAllMocks();
});

/** The OPFS root handle's name is the empty string in every browser. */
const useOpfs = (tree: Record<string, unknown> = {}) => {
	const fs = new MockFileSystem("", tree as never);
	cleanups.push(installOpfs(fs.handle));
	return fs;
};

const renderFs = (overrides: UseFileSystemOptions = {}) =>
	renderHook(() =>
		useFs({
			filters: [],
			pollInterval: 5,
			debounceInterval: 0,
			processingIndicatorDelay: 0,
			...overrides,
		}),
	);

describe("opfs", () => {
	describe("isOpfsSupported", () => {
		it("is false without navigator.storage.getDirectory", () => {
			expect(isOpfsSupported()).toBe(false);
		});

		it("is true once the API is available", () => {
			useOpfs();
			expect(isOpfsSupported()).toBe(true);
		});
	});

	describe("getOpfsRoot", () => {
		it("returns the root handle", async () => {
			useOpfs({ "a.txt": "a" });

			const handle = await getOpfsRoot();

			expect(handle.name).toBe("");
		});

		it("creates and returns a nested subdirectory", async () => {
			const fs = useOpfs();

			const handle = await getOpfsRoot({ name: "notes/2026" });

			expect(handle.name).toBe("2026");

			await fs.write("notes/2026/todo.md", "x");
			expect(fs.paths()).toEqual(["notes/2026/todo.md"]);
		});

		it("rejects a missing subdirectory when create is false", async () => {
			useOpfs();

			await expect(
				getOpfsRoot({ name: "missing", create: false }),
			).rejects.toThrow(NOT_FOUND);
		});

		it("throws when the browser has no OPFS", async () => {
			await expect(getOpfsRoot()).rejects.toThrow(NOT_AVAILABLE);
		});
	});

	describe("addOpfsDirectory", () => {
		it("mounts the root under `opfs` and watches it", async () => {
			useOpfs({ "a.txt": "a", src: { "index.ts": "i" } });

			const { result } = renderFs();

			await act(async () => {
				expect(await result.current.addOpfsDirectory()).toBe("opfs");
			});

			expect(Object.fromEntries(result.current.files)).toEqual({
				"opfs/a.txt": "a",
				"opfs/src/index.ts": "i",
			});
			expect(result.current.directories).toEqual(["opfs"]);
			expect(result.current.isPolling).toBe(true);
		});

		it("mounts a subdirectory under its own name", async () => {
			useOpfs({ notes: { "todo.md": "milk" }, other: { "x.txt": "x" } });

			const { result } = renderFs();

			await act(async () => {
				expect(await result.current.addOpfsDirectory({ name: "notes" })).toBe(
					"notes",
				);
			});

			// Only the mounted subtree is watched, not the rest of the origin.
			expect(Object.fromEntries(result.current.files)).toEqual({
				"notes/todo.md": "milk",
			});
		});

		it("honours an explicit mount path", async () => {
			useOpfs({ notes: { "todo.md": "milk" } });

			const { result } = renderFs();

			await act(async () => {
				await result.current.addOpfsDirectory({ name: "notes", path: "vault" });
			});

			expect(Array.from(result.current.files.keys())).toEqual([
				"vault/todo.md",
			]);
		});

		it("reports OPFS support on the hook", async () => {
			useOpfs();

			const { result } = renderFs();

			await waitFor(() => {
				expect(result.current.isOpfsSupported).toBe(true);
			});
			// OPFS is not the picker: Safari and Firefox have one and not the other.
			expect(result.current.isBrowserSupported).toBe(false);
		});

		it("throws when the browser has no OPFS", async () => {
			const { result } = renderFs();

			await act(async () => {
				await expect(result.current.addOpfsDirectory()).rejects.toThrow(
					NOT_AVAILABLE,
				);
			});
		});

		it("mounting the same directory twice is a no-op", async () => {
			useOpfs({ notes: { "todo.md": "milk" } });

			const { result } = renderFs();

			await act(async () => {
				await result.current.addOpfsDirectory({ name: "notes" });
				expect(await result.current.addOpfsDirectory({ name: "notes" })).toBe(
					"notes",
				);
			});

			expect(result.current.directories).toEqual(["notes"]);
			expect(Array.from(result.current.files.keys())).toEqual([
				"notes/todo.md",
			]);
		});

		it("watches browser storage and a picked folder at once", async () => {
			useOpfs({ notes: { "todo.md": "milk" } });
			const disk = new MockFileSystem("project", { "a.txt": "a" });
			cleanups.push(installDirectoryPicker(disk.handle));

			const { result } = renderFs();

			await act(async () => {
				await result.current.addOpfsDirectory({ name: "notes" });
				await result.current.onDirectorySelection();
			});

			expect(result.current.directories).toEqual(["notes", "project"]);
			expect(Object.fromEntries(result.current.files)).toEqual({
				"notes/todo.md": "milk",
				"project/a.txt": "a",
			});

			// Each root is independent: dropping one leaves the other watched.
			act(() => {
				result.current.removeDirectory("notes");
			});

			expect(result.current.directories).toEqual(["project"]);
			expect(Array.from(result.current.files.keys())).toEqual([
				"project/a.txt",
			]);
		});
	});

	describe("writing", () => {
		it("writes, creates and deletes without any permission prompt", async () => {
			const fs = useOpfs({ "a.txt": "a" });

			const { result } = renderFs();

			await act(async () => {
				await result.current.addOpfsDirectory();
			});

			// OPFS handles have no queryPermission/requestPermission at all.
			await act(async () => {
				await result.current.writeFile("opfs/a.txt", "changed");
				await result.current.createFile("opfs/deep/new.txt", "fresh");
			});

			expect(fs.read("a.txt")).toBe("changed");
			expect(fs.read("deep/new.txt")).toBe("fresh");
			expect(Object.fromEntries(result.current.files)).toEqual({
				"opfs/a.txt": "changed",
				"opfs/deep/new.txt": "fresh",
			});

			await act(async () => {
				await result.current.deleteFile("opfs/a.txt");
			});

			expect(fs.read("a.txt")).toBeUndefined();
			expect(Array.from(result.current.files.keys())).toEqual([
				"opfs/deep/new.txt",
			]);
		});
	});

	describe("addDirectory", () => {
		it("refuses an unnamed handle without a path", async () => {
			const fs = useOpfs({ "a.txt": "a" });

			const { result } = renderFs();

			await act(async () => {
				await expect(result.current.addDirectory(fs.handle)).rejects.toThrow(
					NEEDS_A_PATH,
				);
			});
		});

		it("mounts an unnamed handle under an explicit path", async () => {
			const fs = useOpfs({ "a.txt": "a" });

			const { result } = renderFs();

			await act(async () => {
				expect(
					await result.current.addDirectory(fs.handle, { path: "storage" }),
				).toBe("storage");
			});

			expect(Array.from(result.current.files.keys())).toEqual([
				"storage/a.txt",
			]);
		});
	});
});
