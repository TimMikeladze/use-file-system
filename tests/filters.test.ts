import { describe, expect, it } from "vitest";
import {
	commonFilters,
	createExcludedDirectoryFilter,
	createFilter,
	distFilter,
	gitFilter,
	miscFilter,
} from "../src/filters";
import type { Filter, FilterFn } from "../src/types";
import { walkDirectory } from "../src/walk";
import { MockFileSystem } from "./mock-fs";

const NODE_MODULES = "node_modules";
const GIT_HEAD = "HEAD";

const collect = async (fs: MockFileSystem, factories: FilterFn[]) => {
	const filters = (await Promise.all(
		factories.map((create) => create()),
	)) as Filter[];
	const result = await walkDirectory(fs.handle, "root", filters);

	return Array.from(result.files.keys());
};

describe("createFilter", () => {
	it("defaults missing predicates to allow", async () => {
		const filter = await createFilter({})();

		expect(
			await filter.shouldIncludeFile(
				{ path: "a", rootPath: "", relativePath: "a", name: "a" },
				{} as FileSystemFileHandle,
			),
		).toBe(true);
		expect(
			await filter.shouldProcessDirectory(
				{ path: "a", rootPath: "", relativePath: "a", name: "a" },
				{} as FileSystemDirectoryHandle,
			),
		).toBe(true);
	});
});

describe("distFilter", () => {
	it("prunes build and dependency directories at any depth", async () => {
		const fs = new MockFileSystem("root", {
			"index.ts": "i",
			[NODE_MODULES]: { react: { "index.js": "r" } },
			packages: {
				app: { dist: { "bundle.js": "b" }, src: { "main.ts": "m" } },
			},
		});

		expect(await collect(fs, [distFilter])).toEqual([
			"root/index.ts",
			"root/packages/app/src/main.ts",
		]);
	});

	it("does not exclude the watched root even when it is named `dist`", async () => {
		const fs = new MockFileSystem("dist", { "bundle.js": "b" });
		const filters = (await Promise.all(
			[distFilter].map((create) => create()),
		)) as Filter[];

		const result = await walkDirectory(fs.handle, "dist", filters);

		expect(Array.from(result.files.keys())).toEqual(["dist/bundle.js"]);
	});

	it("is configurable", async () => {
		const fs = new MockFileSystem("root", {
			keep: { "a.ts": "a" },
			drop: { "b.ts": "b" },
		});

		expect(
			await collect(fs, [createExcludedDirectoryFilter(["drop"])]),
		).toEqual(["root/keep/a.ts"]);
	});
});

describe("miscFilter", () => {
	it("drops OS and browser scratch files", async () => {
		const fs = new MockFileSystem("root", {
			".DS_Store": "",
			"Thumbs.db": "",
			"notes.txt.crswap": "",
			"notes.txt": "hello",
		});

		expect(await collect(fs, [miscFilter])).toEqual(["root/notes.txt"]);
	});
});

describe("gitFilter", () => {
	it("applies the root .gitignore regardless of enumeration order", async () => {
		const fs = new MockFileSystem("root", {
			// `.gitignore` sorts after `build/` and `app.log`, so a naive
			// implementation that loads it as it is encountered would miss both.
			"app.log": "log",
			build: { "out.js": "o" },
			src: { "index.ts": "i" },
			".gitignore": "*.log\nbuild/\n",
		});

		expect(await collect(fs, [gitFilter])).toEqual([
			"root/.gitignore",
			"root/src/index.ts",
		]);
	});

	it("matches patterns relative to the .gitignore, not the root name", async () => {
		const fs = new MockFileSystem("root", {
			".gitignore": "/generated\n",
			generated: { "a.ts": "a" },
			src: { generated: { "b.ts": "b" } },
		});

		// A leading slash anchors to the directory holding the .gitignore.
		expect(await collect(fs, [gitFilter])).toEqual([
			"root/.gitignore",
			"root/src/generated/b.ts",
		]);
	});

	it("layers nested .gitignore files, deepest wins", async () => {
		const fs = new MockFileSystem("root", {
			".gitignore": "*.txt\n",
			"top.txt": "t",
			docs: { ".gitignore": "!keep.txt\n", "keep.txt": "k", "drop.txt": "d" },
		});

		expect(await collect(fs, [gitFilter])).toEqual([
			"root/.gitignore",
			"root/docs/.gitignore",
			"root/docs/keep.txt",
		]);
	});

	it("always skips .git directories", async () => {
		const fs = new MockFileSystem("root", {
			".git": { [GIT_HEAD]: "ref", objects: { ab: { cd: "binary" } } },
			"a.ts": "a",
		});

		expect(await collect(fs, [gitFilter])).toEqual(["root/a.ts"]);
	});

	it("keeps per-scan state isolated", async () => {
		const fs = new MockFileSystem("root", {
			".gitignore": "secret.txt\n",
			"secret.txt": "s",
		});

		expect(await collect(fs, [gitFilter])).toEqual(["root/.gitignore"]);

		fs.remove(".gitignore");

		expect(await collect(fs, [gitFilter])).toEqual(["root/secret.txt"]);
	});
});

describe("commonFilters", () => {
	it("combines the built-in filters", async () => {
		const fs = new MockFileSystem("root", {
			".DS_Store": "",
			".gitignore": "*.log\n",
			"debug.log": "l",
			[NODE_MODULES]: { pkg: { "index.js": "p" } },
			src: { "index.ts": "i" },
		});

		expect(await collect(fs, commonFilters)).toEqual([
			"root/.gitignore",
			"root/src/index.ts",
		]);
	});
});
