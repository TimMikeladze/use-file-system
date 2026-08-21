import { describe, expect, it } from "vitest";
// biome-ignore lint/performance/noNamespaceImport: asserting the whole public surface
import * as useFsPackage from "../src/index";

const EXPECTED_EXPORTS = [
	"DEFAULT_BATCH_SIZE",
	"DEFAULT_CONCURRENCY",
	"DEFAULT_DEBOUNCE_INTERVAL",
	"DEFAULT_EXCLUDED_DIRECTORIES",
	"DEFAULT_EXCLUDED_FILES",
	"DEFAULT_EXCLUDED_FILE_SUFFIXES",
	"DEFAULT_OPFS_PATH",
	"DEFAULT_POLL_INTERVAL",
	"DEFAULT_PROCESSING_INDICATOR_DELAY",
	"basename",
	"commonFilters",
	"createExcludedDirectoryFilter",
	"createExcludedFileFilter",
	"createFilter",
	"dirname",
	"distFilter",
	"ensurePermission",
	"getDirectoryPicker",
	"getOpfsRoot",
	"gitFilter",
	"isAbortError",
	"isAtOrWithin",
	"isFileSystemAccessSupported",
	"isNotFoundError",
	"isOpfsSupported",
	"isWithin",
	"joinPath",
	"mapLimit",
	"miscFilter",
	"normalizePath",
	"pathSegments",
	"scanDirectories",
	"toContentMap",
	"useFileSystem",
	"useFs",
	"walkDirectory",
];

describe("public API", () => {
	it("exports exactly the documented surface", () => {
		expect(Object.keys(useFsPackage).sort()).toEqual(EXPECTED_EXPORTS.sort());
	});

	it("aliases useFs to useFileSystem", () => {
		expect(useFsPackage.useFs).toBe(useFsPackage.useFileSystem);
	});

	it("reports no File System Access API in a plain jsdom window", () => {
		expect(useFsPackage.isFileSystemAccessSupported()).toBe(false);
		expect(useFsPackage.getDirectoryPicker()).toBeNull();
		expect(useFsPackage.isOpfsSupported()).toBe(false);
	});

	it("treats handles without the permission API as already granted", async () => {
		expect(
			await useFsPackage.ensurePermission(
				{} as FileSystemDirectoryHandle,
				"readwrite",
			),
		).toBe(true);
	});
});
