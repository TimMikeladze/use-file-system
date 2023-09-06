/* eslint-disable no-await-in-loop */
/* eslint-disable no-restricted-syntax */

import { Filter } from './filters';

/* eslint-disable no-undef */
export const processDirectory = async (
  directoryHandle: FileSystemDirectoryHandle,
  directoryPath: string,
  filters: Filter[],
  includeFiles: Map<string, FileSystemFileHandle>,
  ignoreFilePaths: Set<string>
): Promise<Map<string, FileSystemFileHandle>> => {
  // @ts-ignore
  for await (const handle of directoryHandle.values()) {
    const path = `${directoryPath}/${handle.name}`;
    if (!ignoreFilePaths.has(path)) {
      if (handle.kind === `file`) {
        for (const filter of filters) {
          if (!ignoreFilePaths.has(path)) {
            if (await filter.shouldIncludeFile(path, handle)) {
              includeFiles.set(path, handle);
            } else {
              ignoreFilePaths.add(path);
              includeFiles.delete(path);
            }
          }
        }
      }
    }
  }

  const directories = new Map<string, FileSystemDirectoryHandle>();

  // @ts-ignore
  for await (const handle of directoryHandle.values()) {
    const path = `${directoryPath}/${handle.name}`;

    if (!ignoreFilePaths.has(path)) {
      if (handle.kind === `directory`) {
        for (const filter of filters) {
          if (!ignoreFilePaths.has(path)) {
            if (await filter.shouldProcessDirectory(path, handle)) {
              directories.set(path, handle);
            } else {
              ignoreFilePaths.add(path);
              includeFiles.delete(path);
            }
          }
        }
      }
    }
  }

  for (const [path, handle] of directories) {
    if (!ignoreFilePaths.has(path)) {
      for (const filter of filters) {
        if (!ignoreFilePaths.has(path)) {
          if (await filter.shouldProcessDirectory(path, handle)) {
            await processDirectory(
              handle,
              path,
              filters,
              includeFiles,
              ignoreFilePaths
            );
          } else {
            ignoreFilePaths.add(path);
            includeFiles.delete(path);
          }
        }
      }
    }
  }
  return includeFiles;
};
