# 🗂️ use-file-system

A set of React hooks to interact with the [File System API](https://developer.mozilla.org/en-US/docs/Web/API/File_System_API).

Watch a directory for changes and return a map of filepaths & contents when a file is added, modified or removed.

Check out the 📖 [**Storybook**](https://timmikeladze.github.io/use-file-system) for a live example.

> 🚧 Under active development. Expect breaking changes until v1.0.0.

## 📡 Install

```console
npm install use-file-system

yarn add use-file-system

pnpm add use-file-system
```

> 👋 Hello there! Follow me [@linesofcode](https://twitter.com/linesofcode) or visit [linesofcode.dev](https://linesofcode.dev) for more cool projects like this one.

## 🚀 Getting Started

```tsx
import React from 'react';
import { commonFilters, useWatchDirectory } from 'use-file-system';

export const Example = () => {
  const { onDirectorySelection, files } = useWatchDirectory({
    filters: commonFilters, // filters out .gitignore paths and output paths like node_modules or dist, etc
    onFilesAdded: (newFiles, previousFiles) => {
      console.log('onFilesAdded', newFiles, previousFiles);
    },
    onFilesChanged: (changedFiles, previousFiles) => {
      console.log('onFilesChanged', changedFiles, previousFiles);
    },
    onFilesDeleted: (deletedFiles, previousFiles) => {
      console.log('onFilesDeleted', deletedFiles, previousFiles);
    },
  });

  const [renderCount, setRenderCount] = React.useState(0);

  React.useEffect(() => {
    setRenderCount((count) => count + 1);
  }, [files]);

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '1rem',
      }}
    >
      <div>
        Select a directory on your file-system to watch for changes. The files
        will be listed below. If you have a .gitignore file in the directory,
        the files will be filtered according to the rules in that file.
      </div>
      <div>
        Component will re-render when files are added, changed, or deleted.
      </div>
      <div>
        <div>Number of renders: {renderCount}</div>
      </div>
      <div>
        <div>Number of files: {files.size}</div>
      </div>
      <div>
        <button type="button" onClick={onDirectorySelection}>
          Click here
        </button>
      </div>
      <div>
        {Array.from(files).map(([filePath]) => (
          <div key={filePath}>
            <div>{filePath}</div>
          </div>
        ))}
      </div>
    </div>
  );
};
```

<!-- TSDOC_START -->

## :toolbox: Functions

- [gitFilter](#gear-gitfilter)
- [distFilter](#gear-distfilter)
- [miscFilter](#gear-miscfilter)
- [processDirectory](#gear-processdirectory)
- [useWatchDirectory](#gear-usewatchdirectory)

### :gear: gitFilter

| Function | Type |
| ---------- | ---------- |
| `gitFilter` | `FilterFn` |

### :gear: distFilter

| Function | Type |
| ---------- | ---------- |
| `distFilter` | `FilterFn` |

### :gear: miscFilter

| Function | Type |
| ---------- | ---------- |
| `miscFilter` | `FilterFn` |

### :gear: processDirectory

| Function | Type |
| ---------- | ---------- |
| `processDirectory` | `(directoryHandle: FileSystemDirectoryHandle, directoryPath: string, filters: Filter[], includeFiles: Map<string, FileSystemFileHandle>, ignoreFilePaths: Set<...>) => Promise<...>` |

### :gear: useWatchDirectory

| Function | Type |
| ---------- | ---------- |
| `useWatchDirectory` | `(props: UseFileHandlingHookProps) => { handles: Map<string, FileSystemFileHandle>; onDirectorySelection: () => Promise<void>; files: Map<...>; isProcessing: boolean; }` |


## :wrench: Constants

- [commonFilters](#gear-commonfilters)

### :gear: commonFilters

| Constant | Type |
| ---------- | ---------- |
| `commonFilters` | `FilterFn[]` |



<!-- TSDOC_END -->
