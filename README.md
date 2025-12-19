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
import { useFs, type FileChange, type FilePath } from "use-fs";

function App() {
  const {
    selectDirectory,
    files,
    readFile,
    isSupported,
    clear,
    isScanning,
    writeFile,
    deleteFile,
    createFile,
    startPolling,
    stopPolling,
    isPolling
  } = useFs({
    // Optional array of filter functions. Defaults to defaultFilters
    // which ignores .git, node_modules, dist, .DS_Store, etc.
    // filters: [createGitFilter, createDistFilter, createMiscFilter],

    // Called when files are added, modified, or deleted
    onChange: (changes: FileChange[]) => {
      for (const change of changes) {
        switch (change.type) {
          case 'added':
            console.log('Added:', change.entry.path);
            break;
          case 'modified':
            console.log('Modified:', change.entry.path);
            break;
          case 'deleted':
            console.log('Deleted:', change.path);
            break;
        }
      }
    },

    // Called for background errors (polling failures, etc.)
    onError: (error) => {
      console.error('File system error:', error);
    },
  });

  if (!isSupported) {
    return <div>Browser not supported</div>;
  }

  // Read file content on-demand (lazy loading)
  const handleFileClick = async (path: FilePath) => {
    const content = await readFile(path);
    console.log('File content:', content);
  };

  const handleSaveFile = async (path: FilePath, content: string) => {
    try {
      await writeFile(path, content);
      console.log('File saved successfully');
    } catch (error) {
      console.error('Error saving file:', error);
    }
  };

  const handleDeleteFile = async (path: FilePath) => {
    try {
      await deleteFile(path);
      console.log('File deleted successfully');
    } catch (error) {
      console.error('Error deleting file:', error);
    }
  };

  const handleCreateFile = async () => {
    try {
      // Creates file in selected directory
      await createFile('mydir/newfile.txt' as FilePath, 'Initial content');
      console.log('File created successfully');
    } catch (error) {
      console.error('Error creating file:', error);
    }
  };

  return (
    <div>
      <button
        onClick={selectDirectory}
        disabled={isScanning}
      >
        Select Directory
      </button>

      <button
        onClick={clear}
        disabled={isScanning}
      >
        Clear
      </button>

      <button
        onClick={startPolling}
        disabled={isScanning || isPolling}
      >
        Start Polling
      </button>

      <button
        onClick={stopPolling}
        disabled={isScanning || !isPolling}
      >
        Stop Polling
      </button>

      <div>
        Status: {isPolling ? 'Polling Active' : 'Polling Stopped'}
      </div>

      {files.size > 0 && (
        <div>
          <h2>Files ({files.size}):</h2>
          <div>
            {Array.from(files.entries()).map(([path, entry]) => (
              <div key={path}>
                <h3 onClick={() => handleFileClick(path)} style={{ cursor: 'pointer' }}>
                  {path}
                </h3>
                <p>Size: {entry.size} bytes</p>
                <p>Modified: {new Date(entry.lastModified).toLocaleString()}</p>
                <button onClick={() => handleDeleteFile(path)}>
                  Delete File
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
```

The hook provides several key features:

1. **File System Access**: Prompts users to select a directory and maintains access to it.
2. **Lazy Content Loading**: File metadata is stored in memory; content is read on-demand via `readFile()`.
3. **File Writing**: Write content to files with automatic metadata updates.
4. **File Creation**: Create new files with optional initial content.
5. **File Deletion**: Remove files from the selected directory.
6. **File Watching**: Continuously monitors selected directory for changes with automatic polling.
7. **Polling Control**: Manual control over when to start/stop monitoring for file changes.
8. **Filtering**: Built-in and custom filters to exclude unwanted files/directories.
9. **Type-Safe Changes**: Discriminated union `FileChange` type for type-safe change handling.
10. **Performance Optimizations**:
    - Single-pass directory scanning
    - Static filter initialization
    - Metadata-based change detection (no content reads during polling)
    - Low memory footprint via lazy loading

### Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `filters` | `CreateFilter[]` | `defaultFilters` | Array of filter factories to exclude files/directories |
| `pollInterval` | `number` | `100` | How often to check for changes (ms) |
| `onChange` | `(changes: FileChange[]) => void` | - | Callback when files are added, modified, or deleted |
| `onError` | `(error: Error) => void` | - | Callback for background errors |

### Return Values

| Property | Type | Description |
|----------|------|-------------|
| `selectDirectory` | `() => Promise<void>` | Opens directory picker and starts watching |
| `clear` | `() => void` | Stops watching and clears all state |
| `files` | `Map<FilePath, FileEntry>` | Current file entries (metadata only) |
| `readFile` | `(path: FilePath) => Promise<string>` | Read file content on-demand |
| `writeFile` | `(path: FilePath, content: string, options?) => Promise<void>` | Write to a file |
| `createFile` | `(path: FilePath, content?: string) => Promise<FileEntry>` | Create a new file |
| `deleteFile` | `(path: FilePath) => Promise<void>` | Delete a file |
| `startPolling` | `() => void` | Resume polling after `stopPolling` |
| `stopPolling` | `() => void` | Pause polling without clearing state |
| `isScanning` | `boolean` | Whether a scan is in progress |
| `isPolling` | `boolean` | Whether polling is active |
| `isSupported` | `boolean` | Whether File System API is supported |

### Types

```typescript
// Branded type for file paths
type FilePath = string & { readonly __brand: 'FilePath' };

// File metadata (stored in memory)
interface FileEntry {
  path: FilePath;
  handle: FileSystemFileHandle;
  lastModified: number;
  size: number;
}

// Change event (discriminated union)
type FileChange =
  | { type: 'added'; entry: FileEntry }
  | { type: 'modified'; entry: FileEntry; previousLastModified: number }
  | { type: 'deleted'; path: FilePath };

// Filter interface
interface Filter {
  shouldIncludeFile(path: FilePath): boolean;
  shouldIncludeDirectory(path: FilePath): boolean;
}

// Filter factory (async for reading .gitignore, etc.)
type CreateFilter = (
  rootHandle: FileSystemDirectoryHandle,
  rootPath: FilePath
) => Promise<Filter>;
```

### Built-in Filters

```typescript
import {
  createGitFilter,    // Respects .gitignore
  createDistFilter,   // Excludes dist/, build/, node_modules/, .next/, etc.
  createMiscFilter,   // Excludes .DS_Store, .swp, Thumbs.db, etc.
  defaultFilters,     // All of the above combined
  combineFilters      // Utility to combine multiple filters
} from 'use-fs';
```

### Error Classes

```typescript
import {
  UseFsError,           // Base error class
  FileNotFoundError,    // File doesn't exist
  DirectoryNotFoundError, // Directory doesn't exist
  PermissionDeniedError,  // Permission denied
  NotSupportedError       // Browser doesn't support File System API
} from 'use-fs';
```

## 📚 Contributing

1. Navigate to the `docs` directory
2. Run `pnpm install` to install the dependencies
3. Run `pnpm dev` to start the development server
3. Navigate to `http://localhost:3000` to view the demo.
5. Modify the `Demo.tsx` file to make your changes.

If you're making changes to the `use-fs` package, you can run `pnpm build` to build the package and then run `pnpm link use-fs` to link the package to the `docs` directory for local development and testing.
