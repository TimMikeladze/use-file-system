import { Code } from "./Code";

const STATE = [
	["files", "Map<string, string> of watched files, keyed by path"],
	["handles", "Map of FileSystemFileHandle, keyed by path"],
	["directories", "Paths of the watched roots"],
	["isProcessing", "A scan has run long enough to be worth showing"],
	["isPolling", "The polling loop is running"],
	["isBrowserSupported", "The directory picker is available"],
	["isOpfsSupported", "The origin private file system is available"],
	["error", "Most recent recoverable error, or null"],
];

const ACTIONS = [
	["onDirectorySelection()", "Open the picker and watch the choice"],
	[
		"addOpfsDirectory(options?)",
		"Watch browser storage — no prompt, no gesture",
	],
	["addDirectory(handle, options?)", "Watch a handle you already hold"],
	["removeDirectory(path)", "Stop watching, without touching disk"],
	["refresh()", "Run a scan right now"],
	["startPolling() / stopPolling()", "Drive the loop by hand"],
	["writeFile(path, data, options?)", "Write, creating missing parents"],
	["createFile(path, initialData?)", "Create or open, returns the handle"],
	["deleteFile(path)", "Delete one file"],
	["deleteDirectory(path)", "Delete a directory and everything below"],
	["requestPermission(mode?)", "Re-request access for every root"],
	["onClear()", "Stop watching everything and reset"],
];

const OPTIONS = [
	["filters", "commonFilters"],
	["pollInterval", "300"],
	["debounceInterval", "50"],
	["batchSize", "50"],
	["concurrency", "8"],
	["mode", '"read"'],
	["autoStartPolling", "true"],
	["processingIndicatorDelay", "100"],
];

const FILTER_SNIPPET = `
import { commonFilters, createFilter } from "use-fs";

const onlyTypeScript = createFilter({
  shouldIncludeFile: ({ name }) => name.endsWith(".ts"),
});

useFs({ filters: [...commonFilters, onlyTypeScript] });
`;

const Column = ({ title, rows }: { title: string; rows: string[][] }) => (
	<div className="min-w-0 border-line border-t pt-6 md:border-t-0 md:border-l md:pt-0 md:pl-7 md:first:border-l-0 md:first:pl-0">
		<p className="u-eyebrow">{title}</p>
		<dl className="mt-4">
			{rows.map(([name, gloss]) => (
				<div
					key={name}
					className="border-line-soft border-b py-2.5 last:border-b-0"
				>
					<dt className="text-[12.5px] text-text">{name}</dt>
					<dd className="mt-0.5 text-[11.5px] text-faint leading-snug">
						{gloss}
					</dd>
				</div>
			))}
		</dl>
	</div>
);

export const Surface = () => (
	<section className="border-line border-y bg-panel">
		<div className="u-shell py-16 lg:py-20">
			<p className="u-eyebrow">Every export</p>
			<h2 className="u-h2 mt-4 max-w-[22ch]">The entire API.</h2>

			<div className="mt-10 grid gap-6 md:grid-cols-3 md:gap-0">
				<Column title="State" rows={STATE} />
				<Column title="Actions" rows={ACTIONS} />
				<Column title="Options · default" rows={OPTIONS} />
			</div>

			<div className="mt-12 grid gap-8 border-line border-t pt-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:gap-12">
				<div className="min-w-0">
					<p className="u-eyebrow">Filters</p>
					<h3 className="u-h2 mt-3 text-[1.05rem]!">
						Decide what the hook can see.
					</h3>
					<p className="mt-4 max-w-[52ch] text-[13px] text-dim leading-relaxed">
						<span className="text-text">commonFilters</span> is the default: it
						prunes build output, drops{" "}
						<span className="text-text">.DS_Store</span> and friends, and
						honours every <span className="text-text">.gitignore</span> in the
						tree. Compose your own on top — a filter that rejects a directory
						prunes the whole subtree.
					</p>
					<p className="mt-4 text-[11.5px] text-faint leading-relaxed">
						Also exported: walkDirectory, scanDirectories, toContentMap,
						normalizePath, isFileSystemAccessSupported, isOpfsSupported,
						getDirectoryPicker, getOpfsRoot, ensurePermission.
					</p>
				</div>
				<Code code={FILTER_SNIPPET} filename="filters.ts" />
			</div>
		</div>
	</section>
);
