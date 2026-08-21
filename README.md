# 🗂️ use-fs

A React hook for integrating with the [File System Access API](https://developer.mozilla.org/en-US/docs/Web/API/File_System_Access_API) and the [origin private file system](https://developer.mozilla.org/en-US/docs/Web/API/File_System_API/Origin_private_file_system). Visit [**use-fs.com**](https://use-fs.com) to try it out in your browser.

Point the hook at a directory and it watches everything inside it, re-rendering when a file is added, changed or deleted. That directory can be either of two things:

- **A folder on disk**, chosen by the user through the directory picker. Read, write and manage real files directly, with no repeated file dialogs and nothing uploaded anywhere.
- **The origin private file system (OPFS)**, a private store scoped to your origin. No picker, no permission prompt, and it works in every modern browser.

Both are the same `FileSystemDirectoryHandle` underneath, so they are the same hook, the same `files` map and the same writes - only the backing store changes.

> ⚠️ Note: The directory picker is desktop Chrome, Edge and Opera only - check `isBrowserSupported`. OPFS works in every current browser - check `isOpfsSupported`. See [which store to use](#-picker-or-opfs).

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

## ⚖️ Picker or OPFS?

Same hook, same `files` map, same writes. What differs is who owns the bytes and what the browser asks the user first.

| | Folder on disk | Browser storage (OPFS) |
| --- | --- | --- |
| Entry point | `onDirectorySelection()`, or `addDirectory(handle)` | `addOpfsDirectory()` |
| Support flag | `isBrowserSupported` | `isOpfsSupported` |
| Browsers | Chrome, Edge, Opera - desktop only | Chrome, Edge, Opera, Safari 17+, Firefox 111+ |
| The user sees | A picker, then a permission prompt on first write | Nothing at all |
| User gesture | Required - call it from an event handler | Not required - an effect is fine |
| Where the bytes are | Real files, wherever the user pointed you | A private store scoped to your origin |
| Readable by other apps | Yes - their editor, their terminal, their backups | No - only this origin, only through the API |
| Across a reload | Contents survive; access does not. Re-prompt, or persist the handle in IndexedDB | Both survive. Mount it again and it is all there |
| Cleared by | The user, in their own file manager | Clearing site data, or eviction under storage pressure |
| Capacity | The disk | A quota. `navigator.storage.estimate()` reports it |
| Changed behind your back | Constantly - that is the point | Only by your own workers or another tab |

**Reach for the picker** when the files are the user's and they already care about them: an editor, a linter, a local-first tool that has to interoperate with git and the rest of their machine.

**Reach for OPFS** when the files are your app's: a cache, a scratch workspace, a WASM database, drafts that should survive a reload. Also when you simply need the feature to exist in Safari and Firefox.

Nothing forces the choice - the two are watched by the same hook, so you can offer both and let support decide:

```tsx
const {
  isBrowserSupported,
  isOpfsSupported,
  onDirectorySelection,
  addOpfsDirectory,
  directories,
} = useFs();

<button onClick={() => onDirectorySelection()} disabled={!isBrowserSupported}>
  Open a folder
</button>
<button onClick={() => addOpfsDirectory({ name: "workspace" })} disabled={!isOpfsSupported}>
  Use browser storage
</button>

// Both roots land here, and `files` spans them.
<p>Watching: {directories.join(", ") || "nothing yet"}</p>
```

## 💾 Origin private file system

`addOpfsDirectory()` watches the origin private file system instead of a folder on disk. There is no picker, no permission prompt and no user gesture requirement, so it can be called straight from an effect - and it works in Safari and Firefox, which have no directory picker at all.

```tsx
import { useEffect } from "react";
import { useFs } from "use-fs";

function Notes() {
  const { files, addOpfsDirectory, isOpfsSupported, writeFile } = useFs({
    // Nothing outside this tab writes to OPFS unless a worker or another tab
    // does, so drive scans by hand when you own every write.
    autoStartPolling: false,
  });

  useEffect(() => {
    if (isOpfsSupported) {
      // Mounts <opfs>/notes, creating it if it does not exist.
      addOpfsDirectory({ name: "notes" });
    }
  }, [isOpfsSupported, addOpfsDirectory]);

  return (
    <button onClick={() => writeFile("notes/todo.md", "buy milk")}>
      Save ({files.size} files)
    </button>
  );
}
```

Everything the hook does works the same way against an OPFS mount: filters, `refresh`, polling, `writeFile`, `createFile`, `deleteFile`, `deleteDirectory`. Both stores can be watched at once - `addOpfsDirectory()` and `onDirectorySelection()` add roots to the same `directories` list.

| Option | Default | Description |
| --- | --- | --- |
| `name` | – | Subdirectory of the OPFS root to mount, e.g. `notes` or `notes/2026` |
| `create` | `true` | Create that subdirectory when it does not exist |
| `path` | `name`, else `"opfs"` | Path the mount is exposed under |

**Pass `name`.** The OPFS root is shared by everything on the origin - SQLite WASM journals, Emscripten scratch files, other libraries - so mounting it whole means walking all of that on every scan. A named subdirectory is yours alone.

Worth knowing:

- Contents survive a reload and are private to the origin. The user can wipe them by clearing site data, and the browser may evict them under storage pressure - call `navigator.storage.persist()` to ask for protection.
- Changes are detected from `lastModified` and `size`. OPFS writes are fast enough that a same-size rewrite inside a single millisecond can be missed, which only matters for writes coming from a worker or another tab - writes made through the hook update state directly.
- `createSyncAccessHandle` is worker-only and is not used here. The hook writes through `createWritable`, which needs Chrome 86+, Safari 17+ or Firefox 111+.
- Quota is finite. A write that exceeds it rejects with `QuotaExceededError`, surfaced through `error` and `onError`. `navigator.storage.estimate()` reports the headroom.

`getOpfsRoot()` and `isOpfsSupported()` are exported too, for reaching the handle directly - `(await getOpfsRoot({ name: "notes" })).removeEntry("todo.md")`.

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

OPFS needs none of this: an OPFS handle carries no permission at all, so `addOpfsDirectory` and every write against it work without a prompt or a gesture.

`addDirectory` accepts a handle directly, which is how you restore access across sessions after persisting a handle in IndexedDB:

```tsx
const handle = await loadHandleFromIndexedDb();

if ((await handle.queryPermission({ mode: "read" })) === "granted") {
  await fs.addDirectory(handle);
}
```

The handle's own name is the path it is watched under. Pass `path` to override it, which a handle with no name - the OPFS root is the one that occurs in practice - requires:

```tsx
await fs.addDirectory(handle, { path: "storage" });
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
| `isBrowserSupported: boolean` | Whether the directory picker is available |
| `isOpfsSupported: boolean` | Whether the origin private file system is available |
| `error: Error \| null` | The most recent recoverable error |
| `onDirectorySelection(options?)` | Opens the picker and watches the chosen directory. Resolves to its path, or `null` if the picker was dismissed |
| `addDirectory(handle, options?)` | Watches an existing handle. Resolves to the path it is exposed under |
| `addOpfsDirectory(options?)` | Watches the origin private file system. Resolves to the path it is exposed under |
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

`walkDirectory`, `scanDirectories`, `toContentMap`, `normalizePath`, `isFileSystemAccessSupported`, `isOpfsSupported`, `getDirectoryPicker`, `getOpfsRoot` and `ensurePermission` are exported for building on top of the same primitives the hook uses.

## 📚 Contributing

The demo site depends on the package through `"use-fs": "link:.."`, so it always
runs your local build - there is no `pnpm link` step and no published release
involved. `cd docs && pnpm dev` builds the package first, so a fresh clone works
straight away.

1. Navigate to the `docs` directory
2. Run `pnpm install` to install the dependencies
3. Run `pnpm dev` to start the development server
4. Navigate to `http://localhost:3000` to view the demo

The landing page lives in `docs/src/app/(home)`. A single `useFs` call sits in
`FsStore.tsx` and is shared through context, so the hero's `LivePanel.tsx`, the
`Stores.tsx` comparison and the `Demo.tsx` playground all watch the same
directory - whether it came from the picker or from OPFS. `LivePanel.tsx` also
runs a scripted preview until a directory is opened. Design tokens - the three event
colours, the type roles, the grid - are in `docs/src/app/global.css`.

When changing the package itself, run `pnpm dev` at the repository root in a
second terminal. It rebuilds `dist` on every save and runs the tests in watch
mode, and the demo picks the rebuild up on its next refresh.

Run `pnpm test` for the test suite, `pnpm typecheck` for types and `pnpm lint` for formatting and lint.
