import { afterEach, describe, expect, it, vi } from "vitest";
import { scanDirectories, toContentMap } from "../src/scan";
import type { FileRecord } from "../src/types";
import { MockFileSystem } from "./mock-fs";

const scan = async (
	fs: MockFileSystem,
	previous: ReadonlyMap<string, FileRecord> = new Map(),
	onError?: (error: Error) => void,
) =>
	await scanDirectories({
		directories: new Map([["root", fs.handle]]),
		filters: [],
		previous,
		onError,
	});

afterEach(() => {
	vi.restoreAllMocks();
});

describe("scanDirectories", () => {
	it("reports every file as added on the first scan, with contents", async () => {
		const fs = new MockFileSystem("root", {
			"a.txt": "a",
			src: { "b.ts": "b" },
		});

		const result = await scan(fs);

		expect(Object.fromEntries(result.added)).toEqual({
			"root/a.txt": "a",
			"root/src/b.ts": "b",
		});
		expect(result.changed.size).toBe(0);
		expect(result.deleted.size).toBe(0);
		expect(toContentMap(result.records)).toEqual(result.added);
	});

	it("does not read contents again when nothing changed", async () => {
		const fs = new MockFileSystem("root", { "a.txt": "a", "b.txt": "b" });
		const first = await scan(fs);

		const readSpy = vi.spyOn(Blob.prototype, "text");
		const second = await scan(fs, first.records);

		expect(readSpy).not.toHaveBeenCalled();
		expect(second.added.size).toBe(0);
		expect(second.changed.size).toBe(0);
		expect(second.deleted.size).toBe(0);
		expect(Object.fromEntries(toContentMap(second.records))).toEqual({
			"root/a.txt": "a",
			"root/b.txt": "b",
		});
	});

	it("reports a modified file as changed and not as added", async () => {
		const fs = new MockFileSystem("root", { "a.txt": "a" });
		const first = await scan(fs);

		fs.write("a.txt", "updated");
		const second = await scan(fs, first.records);

		expect(Object.fromEntries(second.changed)).toEqual({
			"root/a.txt": "updated",
		});
		expect(second.added.size).toBe(0);
	});

	it("reports removed files with their last known contents", async () => {
		const fs = new MockFileSystem("root", { "a.txt": "a", "b.txt": "b" });
		const first = await scan(fs);

		fs.remove("b.txt");
		const second = await scan(fs, first.records);

		expect(Object.fromEntries(second.deleted)).toEqual({ "root/b.txt": "b" });
		expect(second.records.has("root/b.txt")).toBe(false);
	});

	it("keeps files under an unreadable directory instead of reporting deletions", async () => {
		const fs = new MockFileSystem("root", {
			"a.txt": "a",
			locked: { "secret.txt": "s" },
		});
		const first = await scan(fs);

		expect(first.added.size).toBe(2);

		fs.setUnreadable("locked");
		const errors: Error[] = [];
		const second = await scan(fs, first.records, (error) => errors.push(error));

		expect(second.deleted.size).toBe(0);
		expect(second.records.get("root/locked/secret.txt")?.content).toBe("s");
		expect(errors).toHaveLength(1);
	});

	it("keeps the last known contents when a file cannot be read", async () => {
		const fs = new MockFileSystem("root", { "a.txt": "a" });
		const first = await scan(fs);

		fs.write("a.txt", "changed");
		vi.spyOn(Blob.prototype, "text").mockRejectedValue(
			new Error("device is on fire"),
		);

		const errors: Error[] = [];
		const second = await scan(fs, first.records, (error) => errors.push(error));

		expect(second.deleted.size).toBe(0);
		expect(second.records.get("root/a.txt")?.content).toBe("a");
		expect(errors.map((error) => error.message)).toEqual(["device is on fire"]);
	});

	it("treats a file that vanished mid-scan as deleted without erroring", async () => {
		const fs = new MockFileSystem("root", { "a.txt": "a" });
		const first = await scan(fs);

		const notFound = new Error("gone");
		notFound.name = "NotFoundError";
		fs.write("a.txt", "changed");
		vi.spyOn(Blob.prototype, "text").mockRejectedValue(notFound);

		const errors: Error[] = [];
		const second = await scan(fs, first.records, (error) => errors.push(error));

		expect(Object.fromEntries(second.deleted)).toEqual({ "root/a.txt": "a" });
		expect(errors).toEqual([]);
	});

	it("scans several watched roots at once", async () => {
		const one = new MockFileSystem("one", { "a.txt": "a" });
		const two = new MockFileSystem("two", { "b.txt": "b" });

		const result = await scanDirectories({
			directories: new Map([
				["one", one.handle],
				["two", two.handle],
			]),
			filters: [],
			previous: new Map(),
		});

		expect(Array.from(result.records.keys()).sort()).toEqual([
			"one/a.txt",
			"two/b.txt",
		]);
	});
});
