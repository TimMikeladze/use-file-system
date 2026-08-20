import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, type Mock, vi } from "vitest";
import { createFilter } from "../src/filters";
import type { UseFileSystemOptions } from "../src/useFileSystem";
import { useFs } from "../src/useFileSystem";
import {
	installDirectoryPicker,
	MockDirectoryHandle,
	MockFileSystem,
} from "./mock-fs";

type Permissioned = FileSystemDirectoryHandle & {
	queryPermission?: () => Promise<PermissionState>;
	requestPermission?: () => Promise<PermissionState>;
};

const NODE_MODULES = "node_modules";

const NOT_AVAILABLE = /not available/;
const FILE_NOT_FOUND = /File not found/;
const NO_WATCHED_DIRECTORY = /No watched directory/;
const NO_TRAVERSAL = /must not contain/;
const PERMISSION_DENIED = /permission was not granted/i;

const cleanups: (() => void)[] = [];

afterEach(() => {
	while (cleanups.length > 0) {
		cleanups.pop()?.();
	}

	vi.restoreAllMocks();
});

const usePicker = (
	handle:
		| FileSystemDirectoryHandle
		| (() => Promise<FileSystemDirectoryHandle>),
) => {
	cleanups.push(installDirectoryPicker(handle));
};

const testOptions = (
	overrides: UseFileSystemOptions = {},
): UseFileSystemOptions => ({
	filters: [],
	pollInterval: 5,
	debounceInterval: 0,
	processingIndicatorDelay: 0,
	...overrides,
});

/** Reads the `Map` argument of a recorded `onFiles*` call as a plain object. */
const eventFiles = (
	mock: Mock,
	{ call = 0, argument = 0 }: { call?: number; argument?: number } = {},
): Record<string, string> => {
	const recorded = mock.mock.calls.at(call)?.[argument] as
		| Map<string, string>
		| undefined;

	return Object.fromEntries(recorded ?? new Map<string, string>());
};

const sleep = (ms: number) =>
	new Promise<void>((resolve) => {
		setTimeout(resolve, ms);
	});

const renderFs = (overrides: UseFileSystemOptions = {}) =>
	renderHook(() => useFs(testOptions(overrides)));

describe("useFileSystem", () => {
	describe("browser support", () => {
		it("is false when the API is missing", async () => {
			const { result } = renderFs();

			await waitFor(() => {
				expect(result.current.isBrowserSupported).toBe(false);
			});
		});

		it("is true once the API is available", async () => {
			usePicker(new MockFileSystem("root").handle);
			const { result } = renderFs();

			await waitFor(() => {
				expect(result.current.isBrowserSupported).toBe(true);
			});
		});
	});

	describe("directory selection", () => {
		it("exposes the selected directory's files and handles", async () => {
			const fs = new MockFileSystem("root", {
				"a.txt": "a",
				src: { "index.ts": "i" },
			});
			usePicker(fs.handle);

			const { result } = renderFs();

			await act(async () => {
				await result.current.onDirectorySelection();
			});

			expect(Object.fromEntries(result.current.files)).toEqual({
				"root/a.txt": "a",
				"root/src/index.ts": "i",
			});
			expect(Array.from(result.current.handles.keys())).toEqual([
				"root/a.txt",
				"root/src/index.ts",
			]);
			expect(result.current.directories).toEqual(["root"]);
			expect(result.current.isPolling).toBe(true);
		});

		it("reports added files with their contents", async () => {
			const fs = new MockFileSystem("root", { "a.txt": "hello" });
			usePicker(fs.handle);

			const onFilesAdded = vi.fn();
			const onFilesChanged = vi.fn();
			const { result } = renderFs({ onFilesAdded, onFilesChanged });

			await act(async () => {
				await result.current.onDirectorySelection();
			});

			expect(onFilesAdded).toHaveBeenCalledTimes(1);
			expect(eventFiles(onFilesAdded)).toEqual({
				"root/a.txt": "hello",
			});
			// A brand new file is added, never "changed".
			expect(onFilesChanged).not.toHaveBeenCalled();
		});

		it("ignores a dismissed picker without surfacing an error", async () => {
			const abort = new Error("The user aborted a request.");
			abort.name = "AbortError";
			usePicker(() => Promise.reject(abort));

			const onError = vi.fn();
			const { result } = renderFs({ onError });

			await act(async () => {
				expect(await result.current.onDirectorySelection()).toBeNull();
			});

			expect(onError).not.toHaveBeenCalled();
			expect(result.current.error).toBeNull();
		});

		it("surfaces real picker failures", async () => {
			usePicker(() => Promise.reject(new Error("nope")));

			const onError = vi.fn();
			const { result } = renderFs({ onError });

			await act(async () => {
				await result.current.onDirectorySelection();
			});

			expect(onError).toHaveBeenCalledTimes(1);
			expect(result.current.error?.message).toBe("nope");
		});

		it("reports an error when the API is unavailable", async () => {
			const onError = vi.fn();
			const { result } = renderFs({ onError });

			await act(async () => {
				expect(await result.current.onDirectorySelection()).toBeNull();
			});

			expect(result.current.error?.message).toMatch(NOT_AVAILABLE);
		});
	});

	describe("watching", () => {
		it("detects changes while polling", async () => {
			const fs = new MockFileSystem("root", { "a.txt": "one" });
			usePicker(fs.handle);

			const onFilesChanged = vi.fn();
			const { result } = renderFs({ onFilesChanged });

			await act(async () => {
				await result.current.onDirectorySelection();
			});

			fs.write("a.txt", "two");

			await waitFor(() => {
				expect(result.current.files.get("root/a.txt")).toBe("two");
			});

			expect(eventFiles(onFilesChanged)).toEqual({
				"root/a.txt": "two",
			});
			// `previousFiles` describes the state before the change.
			expect(eventFiles(onFilesChanged, { argument: 1 })).toEqual({
				"root/a.txt": "one",
			});
		});

		it("detects new and deleted files while polling", async () => {
			const fs = new MockFileSystem("root", { "a.txt": "a" });
			usePicker(fs.handle);

			const onFilesAdded = vi.fn();
			const onFilesDeleted = vi.fn();
			const { result } = renderFs({ onFilesAdded, onFilesDeleted });

			await act(async () => {
				await result.current.onDirectorySelection();
			});

			fs.write("nested/b.txt", "b");

			await waitFor(() => {
				expect(result.current.files.get("root/nested/b.txt")).toBe("b");
			});

			fs.remove("a.txt");

			await waitFor(() => {
				expect(result.current.files.has("root/a.txt")).toBe(false);
			});

			expect(eventFiles(onFilesDeleted, { call: -1 })).toEqual({
				"root/a.txt": "a",
			});
			expect(onFilesAdded).toHaveBeenCalledTimes(2);
		});

		it("uses the latest inline callbacks rather than the ones polling started with", async () => {
			const fs = new MockFileSystem("root", { "a.txt": "one" });
			usePicker(fs.handle);

			const seen: string[] = [];
			const { result, rerender } = renderHook(
				({ tag }: { tag: string }) =>
					useFs(
						testOptions({
							onFilesChanged: (files) => {
								seen.push(`${tag}:${Array.from(files.values()).join()}`);
							},
						}),
					),
				{ initialProps: { tag: "first" } },
			);

			await act(async () => {
				await result.current.onDirectorySelection();
			});

			rerender({ tag: "second" });

			fs.write("a.txt", "two");

			await waitFor(() => {
				expect(seen).toContain("second:two");
			});
		});

		it("stops polling on request and resumes on demand", async () => {
			const fs = new MockFileSystem("root", { "a.txt": "one" });
			usePicker(fs.handle);

			const { result } = renderFs();

			await act(async () => {
				await result.current.onDirectorySelection();
			});

			act(() => {
				result.current.stopPolling();
			});

			expect(result.current.isPolling).toBe(false);

			fs.write("a.txt", "two");
			await act(async () => {
				await sleep(40);
			});

			expect(result.current.files.get("root/a.txt")).toBe("one");

			act(() => {
				result.current.startPolling();
			});

			await waitFor(() => {
				expect(result.current.files.get("root/a.txt")).toBe("two");
			});
		});

		it("refreshes on demand without polling", async () => {
			const fs = new MockFileSystem("root", { "a.txt": "one" });
			usePicker(fs.handle);

			const { result } = renderFs({ autoStartPolling: false });

			await act(async () => {
				await result.current.onDirectorySelection();
			});

			expect(result.current.isPolling).toBe(false);
			expect(result.current.files.get("root/a.txt")).toBe("one");

			fs.write("a.txt", "two");

			await act(async () => {
				await result.current.refresh();
			});

			expect(result.current.files.get("root/a.txt")).toBe("two");
		});

		it("stops touching the file system after unmount", async () => {
			const fs = new MockFileSystem("root", { "a.txt": "a" });
			usePicker(fs.handle);

			const { result, unmount } = renderFs();

			await act(async () => {
				await result.current.onDirectorySelection();
			});

			const valuesSpy = vi.spyOn(MockDirectoryHandle.prototype, "values");

			await act(async () => {
				await sleep(20);
			});

			expect(valuesSpy.mock.calls.length).toBeGreaterThan(0);

			unmount();
			const callsAtUnmount = valuesSpy.mock.calls.length;

			await sleep(40);

			expect(valuesSpy.mock.calls.length).toBe(callsAtUnmount);
		});
	});

	describe("multiple directories", () => {
		it("does not add the same directory twice", async () => {
			const fs = new MockFileSystem("root", { "a.txt": "a" });
			const { result } = renderFs();

			await act(async () => {
				await result.current.addDirectory(fs.handle);
				// A fresh handle object pointing at the same directory.
				await result.current.addDirectory(fs.handle);
			});

			expect(result.current.directories).toEqual(["root"]);
		});

		it("disambiguates directories that share a name", async () => {
			const one = new MockFileSystem("src", { "a.txt": "a" });
			const two = new MockFileSystem("src", { "b.txt": "b" });
			const { result } = renderFs();

			await act(async () => {
				await result.current.addDirectory(one.handle);
				await result.current.addDirectory(two.handle);
			});

			expect(result.current.directories).toEqual(["src", "src (2)"]);
			expect(Object.fromEntries(result.current.files)).toEqual({
				"src/a.txt": "a",
				"src (2)/b.txt": "b",
			});
		});

		it("removes a single directory without disturbing the others", async () => {
			const one = new MockFileSystem("one", { "a.txt": "a" });
			const two = new MockFileSystem("two", { "b.txt": "b" });
			const onFilesDeleted = vi.fn();
			const { result } = renderFs({ onFilesDeleted });

			await act(async () => {
				await result.current.addDirectory(one.handle);
				await result.current.addDirectory(two.handle);
			});

			act(() => {
				result.current.removeDirectory("one");
			});

			expect(result.current.directories).toEqual(["two"]);
			expect(Object.fromEntries(result.current.files)).toEqual({
				"two/b.txt": "b",
			});
			expect(eventFiles(onFilesDeleted)).toEqual({
				"one/a.txt": "a",
			});
		});
	});

	describe("onClear", () => {
		it("resets every piece of state", async () => {
			const fs = new MockFileSystem("root", { "a.txt": "a" });
			usePicker(fs.handle);

			const { result } = renderFs();

			await act(async () => {
				await result.current.onDirectorySelection();
			});

			act(() => {
				result.current.onClear();
			});

			expect(result.current.files.size).toBe(0);
			expect(result.current.handles.size).toBe(0);
			expect(result.current.directories).toEqual([]);
			expect(result.current.isPolling).toBe(false);
			expect(result.current.error).toBeNull();

			fs.write("a.txt", "changed");
			await act(async () => {
				await sleep(30);
			});

			expect(result.current.files.size).toBe(0);
		});
	});

	describe("writeFile", () => {
		it("replaces the file's contents by default", async () => {
			const fs = new MockFileSystem("root", { "a.txt": "hello world" });
			usePicker(fs.handle);

			const { result } = renderFs();

			await act(async () => {
				await result.current.onDirectorySelection();
				await result.current.writeFile("root/a.txt", "hi");
			});

			expect(fs.read("a.txt")).toBe("hi");
			expect(result.current.files.get("root/a.txt")).toBe("hi");
		});

		it("keeps trailing data when truncate is false", async () => {
			const fs = new MockFileSystem("root", { "a.txt": "hello world" });
			usePicker(fs.handle);

			const { result } = renderFs();

			await act(async () => {
				await result.current.onDirectorySelection();
				await result.current.writeFile("root/a.txt", "HELLO", {
					truncate: false,
				});
			});

			expect(fs.read("a.txt")).toBe("HELLO world");
		});

		it("creates missing files and parent directories", async () => {
			const fs = new MockFileSystem("root", {});
			usePicker(fs.handle);

			const onFilesAdded = vi.fn();
			const { result } = renderFs({ onFilesAdded });

			await act(async () => {
				await result.current.onDirectorySelection();
				await result.current.writeFile("root/deep/nested/new.txt", "created");
			});

			expect(fs.read("deep/nested/new.txt")).toBe("created");
			expect(result.current.files.get("root/deep/nested/new.txt")).toBe(
				"created",
			);
			expect(onFilesAdded).toHaveBeenCalledTimes(1);
		});

		it("refuses to create a file when create is false", async () => {
			const fs = new MockFileSystem("root", {});
			usePicker(fs.handle);

			const { result } = renderFs();

			await act(async () => {
				await result.current.onDirectorySelection();
			});

			await expect(
				result.current.writeFile("root/missing.txt", "x", { create: false }),
			).rejects.toThrow(FILE_NOT_FOUND);
		});

		it("rejects paths outside every watched directory", async () => {
			const fs = new MockFileSystem("root", { "a.txt": "a" });
			usePicker(fs.handle);

			const { result } = renderFs();

			await act(async () => {
				await result.current.onDirectorySelection();
			});

			await expect(
				result.current.writeFile("elsewhere/a.txt", "x"),
			).rejects.toThrow(NO_WATCHED_DIRECTORY);
		});

		it("rejects traversal outside the watched directory", async () => {
			const fs = new MockFileSystem("root", { "a.txt": "a" });
			usePicker(fs.handle);

			const { result } = renderFs();

			await act(async () => {
				await result.current.onDirectorySelection();
			});

			await expect(
				result.current.writeFile("root/../../etc/passwd", "x"),
			).rejects.toThrow(NO_TRAVERSAL);
		});

		it("does not report its own write as a change on the next poll", async () => {
			const fs = new MockFileSystem("root", { "a.txt": "one" });
			usePicker(fs.handle);

			const onFilesChanged = vi.fn();
			const { result } = renderFs({ onFilesChanged });

			await act(async () => {
				await result.current.onDirectorySelection();
				await result.current.writeFile("root/a.txt", "two");
			});

			expect(onFilesChanged).toHaveBeenCalledTimes(1);

			await act(async () => {
				await sleep(30);
			});

			expect(onFilesChanged).toHaveBeenCalledTimes(1);
		});

		it("requests write permission when the handle exposes the permission API", async () => {
			const fs = new MockFileSystem("root", { "a.txt": "a" });
			const handle = fs.handle as FileSystemDirectoryHandle & {
				queryPermission: () => Promise<PermissionState>;
				requestPermission: () => Promise<PermissionState>;
			};
			handle.queryPermission = vi.fn(() => Promise.resolve("prompt" as const));
			handle.requestPermission = vi.fn(() =>
				Promise.resolve("denied" as const),
			);
			usePicker(handle);

			const { result } = renderFs();

			await act(async () => {
				await result.current.onDirectorySelection();
			});

			await expect(result.current.writeFile("root/a.txt", "x")).rejects.toThrow(
				PERMISSION_DENIED,
			);
			expect(handle.requestPermission).toHaveBeenCalled();
		});
	});

	describe("createFile", () => {
		it("creates an empty file", async () => {
			const fs = new MockFileSystem("root", {});
			usePicker(fs.handle);

			const { result } = renderFs();

			await act(async () => {
				await result.current.onDirectorySelection();
				await result.current.createFile("root/empty.txt");
			});

			expect(fs.read("empty.txt")).toBe("");
			expect(result.current.files.get("root/empty.txt")).toBe("");
		});

		it("seeds a file with initial contents, including an empty string", async () => {
			const fs = new MockFileSystem("root", { "a.txt": "existing" });
			usePicker(fs.handle);

			const { result } = renderFs();

			await act(async () => {
				await result.current.onDirectorySelection();
				await result.current.createFile("root/b.txt", "seeded");
				await result.current.createFile("root/a.txt", "");
			});

			expect(fs.read("b.txt")).toBe("seeded");
			expect(fs.read("a.txt")).toBe("");
		});
	});

	describe("deleteFile", () => {
		it("removes the file from disk and from state", async () => {
			const fs = new MockFileSystem("root", { "a.txt": "a", "b.txt": "b" });
			usePicker(fs.handle);

			const onFilesDeleted = vi.fn();
			const { result } = renderFs({ onFilesDeleted });

			await act(async () => {
				await result.current.onDirectorySelection();
				await result.current.deleteFile("root/a.txt");
			});

			expect(fs.paths()).toEqual(["b.txt"]);
			expect(result.current.files.has("root/a.txt")).toBe(false);
			expect(eventFiles(onFilesDeleted)).toEqual({
				"root/a.txt": "a",
			});
		});

		it("propagates a missing file", async () => {
			const fs = new MockFileSystem("root", {});
			usePicker(fs.handle);

			const { result } = renderFs();

			await act(async () => {
				await result.current.onDirectorySelection();
			});

			await expect(
				result.current.deleteFile("root/missing.txt"),
			).rejects.toThrow();
		});
	});

	describe("deleteDirectory", () => {
		it("removes a directory and everything under it", async () => {
			const fs = new MockFileSystem("root", {
				keep: { "a.txt": "a" },
				drop: { "b.txt": "b", deeper: { "c.txt": "c" } },
			});
			usePicker(fs.handle);

			const onFilesDeleted = vi.fn();
			const { result } = renderFs({ onFilesDeleted });

			await act(async () => {
				await result.current.onDirectorySelection();
				await result.current.deleteDirectory("root/drop");
			});

			expect(fs.paths()).toEqual(["keep/a.txt"]);
			expect(Object.keys(Object.fromEntries(result.current.files))).toEqual([
				"root/keep/a.txt",
			]);
			expect(Object.keys(eventFiles(onFilesDeleted)).sort()).toEqual([
				"root/drop/b.txt",
				"root/drop/deeper/c.txt",
			]);
		});
	});

	describe("filters", () => {
		it("defaults to the common filters", async () => {
			const fs = new MockFileSystem("root", {
				".DS_Store": "",
				".gitignore": "ignored.txt\n",
				"ignored.txt": "x",
				[NODE_MODULES]: { pkg: { "index.js": "p" } },
				"kept.ts": "k",
			});
			usePicker(fs.handle);

			const { result } = renderHook(() =>
				useFs({ pollInterval: 5, debounceInterval: 0 }),
			);

			await act(async () => {
				await result.current.onDirectorySelection();
			});

			expect(Array.from(result.current.files.keys()).sort()).toEqual([
				"root/.gitignore",
				"root/kept.ts",
			]);
		});
	});

	describe("requestPermission", () => {
		it("asks every watched directory and reports the weakest answer", async () => {
			const granted = new MockFileSystem("granted", {}).handle as Permissioned;
			granted.queryPermission = vi.fn(() =>
				Promise.resolve("granted" as const),
			);
			const denied = new MockFileSystem("denied", {}).handle as Permissioned;
			denied.queryPermission = vi.fn(() => Promise.resolve("prompt" as const));
			denied.requestPermission = vi.fn(() =>
				Promise.resolve("denied" as const),
			);

			const { result } = renderFs();

			await act(async () => {
				await result.current.addDirectory(granted);
				await result.current.addDirectory(denied);
			});

			await act(async () => {
				expect(await result.current.requestPermission()).toBe(false);
			});

			expect(granted.queryPermission).toHaveBeenCalledWith({
				mode: "readwrite",
			});
			expect(denied.requestPermission).toHaveBeenCalled();
		});
	});

	describe("debouncing", () => {
		it("coalesces rendered updates while callbacks fire immediately", async () => {
			const fs = new MockFileSystem("root", { "a.txt": "one" });
			usePicker(fs.handle);

			const onFilesChanged = vi.fn();
			const { result } = renderHook(() =>
				useFs(
					testOptions({
						debounceInterval: 40,
						onFilesChanged,
						pollInterval: 2,
					}),
				),
			);

			await act(async () => {
				await result.current.onDirectorySelection();
			});

			await waitFor(() => {
				expect(result.current.files.get("root/a.txt")).toBe("one");
			});

			fs.write("a.txt", "two");

			await waitFor(() => {
				expect(onFilesChanged).toHaveBeenCalledTimes(1);
			});

			// The callback has already fired; the rendered map catches up later.
			await waitFor(() => {
				expect(result.current.files.get("root/a.txt")).toBe("two");
			});
		});
	});

	describe("isProcessing", () => {
		it("stays false for scans that finish quickly", async () => {
			const fs = new MockFileSystem("root", { "a.txt": "a" });
			usePicker(fs.handle);

			const { result } = renderHook(() =>
				useFs(testOptions({ processingIndicatorDelay: 5000 })),
			);

			await act(async () => {
				await result.current.onDirectorySelection();
			});

			expect(result.current.isProcessing).toBe(false);
		});

		it("becomes true while a slow scan is running", async () => {
			const fs = new MockFileSystem("root", { "a.txt": "a" });
			usePicker(fs.handle);

			const { result } = renderHook(() =>
				useFs(
					testOptions({
						processingIndicatorDelay: 1,
						filters: [
							createFilter({
								onDirectoryEnter: () => sleep(30),
							}),
						],
					}),
				),
			);

			let selection: Promise<unknown> | undefined;

			await act(async () => {
				selection = result.current.onDirectorySelection();
				await sleep(15);
			});

			expect(result.current.isProcessing).toBe(true);

			await act(async () => {
				await selection;
			});

			expect(result.current.isProcessing).toBe(false);
		});
	});
});
