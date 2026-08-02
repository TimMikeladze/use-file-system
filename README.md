# 🗂️ use-fs

A React hook for integrating with the [File System Access API](https://developer.mozilla.org/en-US/docs/Web/API/File_System_Access_API). Visit [**use-fs.com**](https://use-fs.com) to try it out in your browser.

The File System Access API enables web applications to seamlessly work with files on a user's local system. After a user grants permission, web apps can read, write, and manage files directly - eliminating the need for repeated file selection dialogs. This capability is ideal for creating powerful browser-based tools.

Unlike traditional file selection dialogs, the user will be prompted to select a directory, the hook will watch the files in that directory for changes - rerendering when changes are detected.

> ⚠️ Note: The File System API is not supported in all browsers. Works on Desktop in Chrome, Edge and Opera.

## 📡 Install

```console
npm install use-fs

yarn add use-fs

pnpm add use-fs
```

> 👋 Hello there! Follow me [@linesofcode](https://twitter.com/linesofcode) or visit [linesofcode.dev](https://linesofcode.dev) for more cool projects like this one.

## 🚀 Getting Started

```tsx
import { useFs } from "use-fs";

function App() {
  const {
    onDirectorySelection,
    files,
    isBrowserSupported,
    onClear,
    isProcessing,
    writeFile,
    deleteFile,
    startPolling,
    stopPolling,
    isPolling,
    error,
  } = useFs({
    // Called when new files appear in a watched directory.
    onFilesAdded: (newFiles, previousFiles) => {
      // newFiles: Map<string, string> - path -> contents
      // previousFiles: Map<string, string> - the state before this change
      console.log("Files added:", newFiles);
    },

    // Called when a watched file's contents change.
    onFilesChanged: (changedFiles, previousFiles) => {
      console.log("Files changed:", changedFiles);
    },

    // Called when a watched file disappears. The map holds its last contents.
    onFilesDeleted: (deletedFiles, previousFiles) => {
      console.log("Files deleted:", deletedFiles);
    },
  });

  if (!isBrowserSupported) {
    return <div>Browser not supported</div>;
  }

  return (
    <div>
      <button onClick={() => onDirectorySelection()}>Select Directory</button>
      <button onClick={onClear}>Clear</button>

      <button onClick={startPolling} disabled={isPolling}>
        Start Polling
      </button>
      <button onClick={stopPolling} disabled={!isPolling}>
        Stop Polling
      </button>

      <div>Status: {isPolling ? "Polling Active" : "Polling Stopped"}</div>
      {error && <div role="alert">{error.message}</div>}

      {Array.from(files.entries()).map(([path, content]) => (
        <div key={path}>
          <h3>{path}</h3>
          <pre>{content}</pre>
          <button onClick={() => writeFile(path, "New content")}>Save</button>
          <button onClick={() => deleteFile(path)}>Delete</button>
        </div>
      ))}
    </div>
  );
}
```

Paths are POSIX-style and always prefixed with the name of the watched root directory, e.g. `my-project/src/index.ts`. Every path passed to `writeFile`, `createFile`, `deleteFile` and `deleteDirectory` must resolve inside a watched directory; `.` and `..` segments are rejected.

## 🔍 How watching works

The hook re-scans every watched directory on an interval:

1. The tree is walked breadth-first with a bounded number of directories open at once. Filters that reject a directory prune the whole subtree, so `node_modules` is never enumerated.
2. Each discovered file is stat'd. Contents are only re-read when `lastModified` or `size` changed, so a steady-state poll over a large tree does no content I/O.
3. Added, changed and deleted files are diffed against the previous scan and reported through the callbacks. Rendered state updates are coalesced by `debounceInterval`; callbacks always fire immediately.

Scans never throw. A directory that cannot be enumerated (revoked permission, removed mid-scan) keeps its last known contents instead of being reported as deleted, and the error is surfaced through `error` and `onError`.

## 🔐 Permissions

`onDirectorySelection` requests `mode: "read"` by default. Writing prompts for `readwrite` access the first time it is needed, which requires a user gesture - so call `writeFile` from an event handler. To get write access up front, pass `mode: "readwrite"`:

```tsx
const fs = useFs({ mode: "readwrite" });
```

`addDirectory` accepts a handle directly, which is how you restore access across sessions after persisting a handle in IndexedDB:

```tsx
const handle = await loadHandleFromIndexedDb();

if ((await handle.queryPermission({ mode: "read" })) === "granted") {
  await fs.addDirectory(handle);
}
```

## 🧹 Filters

A filter decides which entries are visible to the hook. `commonFilters` (the default) prunes build output, drops OS scratch files and honours every `.gitignore` in the tree.

```tsx
import { commonFilters, createFilter, useFs } from "use-fs";

const onlyTypeScript = createFilter({
  shouldIncludeFile: ({ name }) => name.endsWith(".ts") || name.endsWith(".tsx"),
});

useFs({ filters: [...commonFilters, onlyTypeScript] });
```

Every callback receives a context object rather than a bare path:

| Field | Description |
| --- | --- |
| `path` | Full path including the watched root, e.g. `my-project/src/index.ts` |
| `rootPath` | Path of the watched root, e.g. `my-project` |
| `relativePath` | Path relative to the watched root, e.g. `src/index.ts` |
| `name` | Name of the entry, e.g. `index.ts` |

Filters may also implement `onDirectoryEnter`, which runs before any of a directory's entries are tested - that is how `gitFilter` loads a `.gitignore` before deciding anything in its directory.

Built-in filters:

- `distFilter` - prunes `node_modules`, `dist`, `build`, `out`, `vendor`, `coverage`, `.next`, `.nuxt`, `.turbo`, `.cache`, `.output`, `.svelte-kit`, `.parcel-cache`
- `miscFilter` - drops `.DS_Store`, `Thumbs.db`, `desktop.ini` and `*.crswap`
- `gitFilter` - honours nested `.gitignore` files and always skips `.git`
- `commonFilters` - all of the above

Builders: `createFilter`, `createExcludedDirectoryFilter`, `createExcludedFileFilter`.

### Options

| Option | Default | Description |
| --- | --- | --- |
| `filters` | `commonFilters` | Filters applied while walking watched directories |
| `onFilesAdded` | – | Called with files seen for the first time |
| `onFilesChanged` | – | Called with files whose contents changed |
| `onFilesDeleted` | – | Called with files that disappeared, mapped to their last known contents |
| `onError` | – | Called for every recoverable error |
| `pollInterval` | `300` | Delay between scans, in milliseconds |
| `debounceInterval` | `50` | How long rendered state updates are coalesced. `0` updates synchronously |
| `batchSize` | `50` | Maximum number of files read concurrently |
| `concurrency` | `8` | Maximum number of directories enumerated concurrently |
| `mode` | `"read"` | Access level requested when opening the picker |
| `autoStartPolling` | `true` | Start polling as soon as a directory is added |
| `processingIndicatorDelay` | `100` | How long a scan must run before `isProcessing` flips to `true` |

Options are read at the moment they are used, so inline callbacks and filter arrays never need to be memoized.

### Return values

| Value | Description |
| --- | --- |
| `files: Map<string, string>` | Watched files, keyed by path |
| `handles: Map<string, FileSystemFileHandle>` | File handles, keyed by path |
| `directories: string[]` | Paths of the watched root directories |
| `isProcessing: boolean` | Whether a scan has been running long enough to be worth showing |
| `isPolling: boolean` | Whether the hook is polling for changes |
| `isBrowserSupported: boolean` | Whether the File System Access API is available |
| `error: Error \| null` | The most recent recoverable error |
| `onDirectorySelection(options?)` | Opens the picker and watches the chosen directory. Resolves to its path, or `null` if the picker was dismissed |
| `addDirectory(handle)` | Watches an existing handle. Resolves to the path it is exposed under |
| `removeDirectory(path)` | Stops watching a directory without touching disk |
| `onClear()` | Stops watching everything and resets the hook |
| `refresh()` | Runs a scan immediately |
| `startPolling()` / `stopPolling()` | Manual control over the polling loop |
| `writeFile(path, data, options?)` | Writes to a file, creating it and any missing parents by default |
| `createFile(path, initialData?)` | Creates (or opens) a file and returns its handle |
| `deleteFile(path)` | Deletes a file |
| `deleteDirectory(path)` | Deletes a directory and everything below it |
| `requestPermission(mode?)` | Requests access for every watched directory |

`writeFile` replaces the file's contents by default. Pass `{ truncate: false }` to write over the existing bytes from offset `0` and keep anything trailing, or `{ create: false }` to fail instead of creating a missing file.

### Lower-level exports

`walkDirectory`, `scanDirectories`, `toContentMap`, `normalizePath`, `isFileSystemAccessSupported`, `getDirectoryPicker` and `ensurePermission` are exported for building on top of the same primitives the hook uses.

## 📚 Contributing

1. Navigate to the `docs` directory
2. Run `pnpm install` to install the dependencies
3. Run `pnpm dev` to start the development server
4. Navigate to `http://localhost:3000` to view the demo.
5. Modify the `Demo.tsx` file to make your changes.

If you're making changes to the `use-fs` package, you can run `pnpm build` to build the package and then run `pnpm link use-fs` to link the package to the `docs` directory for local development and testing.

Run `pnpm test` for the test suite, `pnpm typecheck` for types and `pnpm lint` for formatting and lint.
