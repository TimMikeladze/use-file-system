import { describe, expect, it, vi } from "vitest";
import { createFilter } from "../src/filters";
import type { Filter } from "../src/types";
import { walkDirectory } from "../src/walk";
import { MockFileSystem } from "./mock-fs";

const instantiate = async (factories: ReturnType<typeof createFilter>[]) =>
	(await Promise.all(factories.map((create) => create()))) as Filter[];

describe("walkDirectory", () => {
	it("collects every file when no filters are supplied", async () => {
		const fs = new MockFileSystem("root", {
			"a.txt": "a",
			src: { "index.ts": "i", nested: { "deep.ts": "d" } },
		});

		const result = await walkDirectory(fs.handle, "root", []);

		expect(Array.from(result.files.keys())).toEqual([
			"root/a.txt",
			"root/src/index.ts",
			"root/src/nested/deep.ts",
		]);
		expect(result.errors).toEqual([]);
		expect(result.unreadableDirectories).toEqual([]);
	});

	it("keeps relative paths intact for an unnamed root", async () => {
		// `walkDirectory` is public, and the OPFS root handle's name is "".
		const fs = new MockFileSystem("", {
			"a.txt": "a",
			src: { "index.ts": "i" },
		});
		const seen: string[] = [];
		const filters = await instantiate([
			createFilter({
				shouldIncludeFile: ({ relativePath }) => {
					seen.push(relativePath);
					return true;
				},
			}),
		]);

		const result = await walkDirectory(fs.handle, "", filters);

		expect(Array.from(result.files.keys())).toEqual(["a.txt", "src/index.ts"]);
		expect(seen).toEqual(["a.txt", "src/index.ts"]);
	});

	it("prunes directories instead of walking into them", async () => {
		const fs = new MockFileSystem("root", {
			"a.txt": "a",
			skipped: { "b.txt": "b", deeper: { "c.txt": "c" } },
		});

		const shouldProcessDirectory = vi.fn(
			({ name }: { name: string }) => name !== "skipped",
		);
		const filters = await instantiate([
			createFilter({ shouldProcessDirectory }),
		]);

		const result = await walkDirectory(fs.handle, "root", filters);

		expect(Array.from(result.files.keys())).toEqual(["root/a.txt"]);
		// The pruned subtree was never enumerated, so `deeper` was never tested.
		expect(
			shouldProcessDirectory.mock.calls.map(([context]) => context.name),
		).toEqual(["skipped"]);
	});

	it("enters a directory before testing any of its entries", async () => {
		const fs = new MockFileSystem("root", {
			src: { "a.ts": "a", "b.ts": "b" },
		});

		const events: string[] = [];
		const filters = await instantiate([
			createFilter({
				onDirectoryEnter: ({ path }) => {
					events.push(`enter:${path}`);
				},
				shouldIncludeFile: ({ path }) => {
					events.push(`file:${path}`);
					return true;
				},
				shouldProcessDirectory: ({ path }) => {
					events.push(`dir:${path}`);
					return true;
				},
			}),
		]);

		await walkDirectory(fs.handle, "root", filters);

		expect(events).toEqual([
			"enter:root",
			"dir:root/src",
			"enter:root/src",
			"file:root/src/a.ts",
			"file:root/src/b.ts",
		]);
	});

	it("reports unreadable directories instead of rejecting", async () => {
		const fs = new MockFileSystem("root", {
			"a.txt": "a",
			locked: { "secret.txt": "s" },
		});
		fs.setUnreadable("locked");

		const result = await walkDirectory(fs.handle, "root", []);

		expect(Array.from(result.files.keys())).toEqual(["root/a.txt"]);
		expect(result.unreadableDirectories).toEqual(["root/locked"]);
		expect(result.errors).toHaveLength(1);
		expect(result.errors[0]?.name).toBe("NotAllowedError");
	});

	it("reports the root itself when it cannot be read", async () => {
		const fs = new MockFileSystem("root", { "a.txt": "a" });
		fs.setUnreadable("");

		const result = await walkDirectory(fs.handle, "root", []);

		expect(result.files.size).toBe(0);
		expect(result.unreadableDirectories).toEqual(["root"]);
	});

	it("keeps at most `concurrency` directories open at once", async () => {
		const fs = new MockFileSystem("root", {
			a: { "1.txt": "1" },
			b: { "1.txt": "1" },
			c: { "1.txt": "1" },
			d: { "1.txt": "1" },
			e: { "1.txt": "1" },
		});

		let active = 0;
		let peak = 0;
		const filters = await instantiate([
			createFilter({
				onDirectoryEnter: async () => {
					active += 1;
					peak = Math.max(peak, active);
					await new Promise<void>((resolve) => {
						setTimeout(resolve, 1);
					});
					active -= 1;
				},
			}),
		]);

		const result = await walkDirectory(fs.handle, "root", filters, {
			concurrency: 2,
		});

		expect(result.files.size).toBe(5);
		expect(peak).toBeLessThanOrEqual(2);
	});

	it("stops early when the signal is aborted", async () => {
		const fs = new MockFileSystem("root", {
			a: { "1.txt": "1" },
			b: { "1.txt": "1" },
		});
		const controller = new AbortController();
		controller.abort();

		const result = await walkDirectory(fs.handle, "root", [], {
			signal: controller.signal,
		});

		expect(result.files.size).toBe(0);
	});
});
