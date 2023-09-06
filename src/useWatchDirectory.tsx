/* eslint-disable no-await-in-loop */
/* eslint-disable no-restricted-syntax */
/* eslint-disable no-undef */
import {
  EffectCallback,
  useEffect,
  useRef,
  useState,
  useCallback,
} from 'react';
import { Filter, FilterFn } from './filters';
import { processDirectory } from './processDirectory';

export interface UseFileHandlingHookProps {
  filters?: Array<FilterFn>;
  onFilesAdded?: (
    newFiles: Map<string, string>,
    previousFiles: Map<string, string>
  ) => void;
  onFilesChanged?: (
    changedFiles: Map<string, string>,
    previousFiles: Map<string, string>
  ) => void;
  onFilesDeleted?: (
    deletedFiles: Map<string, string>,
    previousFiles: Map<string, string>
  ) => void;
  pollInterval?: number;
}

const DEFAULT_POLL_INTERVAL = 500;

export const useWatchDirectory = (props: UseFileHandlingHookProps) => {
  const {
    onFilesAdded: onAddFile,
    onFilesChanged: onChangeFile,
    onFilesDeleted: onDeleteFile,
  } = props;

  const watchedDirectoriesRef = useRef<Map<string, FileSystemDirectoryHandle>>(
    new Map()
  );
  const handlesRef = useRef<Map<string, FileSystemFileHandle>>(new Map());
  const previousHandlesRef = useRef<Set<string>>(new Set());
  const filesMapRef = useRef<Record<string, string>>({});
  const previousFilesMapRef = useRef<Record<string, string>>({});
  const intervalRef = useRef<any>();
  const [files, setFiles] = useState<Map<string, string>>(new Map());
  const [isProcessing, setIsProcessing] = useState(false);

  const processWatchedDirectories = useCallback(async () => {
    const temporaryHandles = new Map<string, FileSystemFileHandle>();
    const ignoreFilePaths = new Set<string>();

    const filterFns: FilterFn[] = props.filters || [];
    const filters: Filter[] = [];

    for (const filterFn of filterFns) {
      filters.push(await filterFn());
    }

    for (const [
      directoryPath,
      directoryHandle,
    ] of watchedDirectoriesRef.current) {
      await processDirectory(
        directoryHandle,
        directoryPath,
        filters,
        temporaryHandles,
        ignoreFilePaths
      );
    }

    for (const [filePath] of temporaryHandles) {
      if (ignoreFilePaths.has(filePath)) {
        temporaryHandles.delete(filePath);
      }
    }

    handlesRef.current = new Map(Array.from(temporaryHandles));
  }, [props.filters]);

  const processFiles = useCallback(async () => {
    previousFilesMapRef.current = {
      ...(filesMapRef.current || {}),
    };

    const seenFiles = new Set<string>();
    const changedFiles = new Map<string, string>();
    const deletedFilesSet = new Set<string>();

    let rerender = false;

    await Promise.all(
      Array.from(handlesRef.current).map(async ([filePath, handle]) => {
        if (!handle || !handle?.getFile) {
          return;
        }

        seenFiles.add(filePath);

        try {
          const file = await handle.getFile();
          const text = await file.text();

          if (text !== filesMapRef.current[filePath]) {
            filesMapRef.current[filePath] = text;
            changedFiles.set(filePath, text);
          }
        } catch (error) {
          handlesRef.current.delete(filePath);
          deletedFilesSet.add(filePath);
          delete filesMapRef.current[filePath];
          rerender = true;
        }
      })
    );

    const deletedFiles = Array.from([
      ...Array.from(previousHandlesRef.current),
      ...Array.from(deletedFilesSet),
    ]).filter((filePath) => !seenFiles.has(filePath));

    const addedFiles = Array.from(seenFiles).filter(
      (filePath) => !previousHandlesRef.current.has(filePath)
    );

    const addedFilesMap = new Map<string, string>();

    for (const addedFile of addedFiles) {
      addedFilesMap.set(addedFile, filesMapRef.current[addedFile]);
    }

    const deletedFilesMap = new Map<string, string>();

    for (const deletedFile of deletedFiles) {
      deletedFilesMap.set(deletedFile, filesMapRef.current[deletedFile]);
      handlesRef.current.delete(deletedFile);
      delete filesMapRef.current[deletedFile];
    }

    const previousFiles = new Map<string, string>(
      Array.from(previousHandlesRef.current).map((filePath) => [
        filePath,
        filesMapRef.current[filePath],
      ])
    );

    if (changedFiles.size) {
      rerender = true;
      onChangeFile?.(changedFiles, previousFiles);
    }

    if (deletedFiles.length) {
      rerender = true;
      onDeleteFile?.(deletedFilesMap, previousFiles);
    }

    if (addedFiles.length) {
      rerender = true;
      onAddFile?.(addedFilesMap, previousFiles);
    }

    previousHandlesRef.current = seenFiles;

    if (
      !rerender &&
      Object.keys(filesMapRef.current).length ===
        Object.keys(previousFilesMapRef.current).length
    ) {
      for (const [filePath, text] of Object.entries(filesMapRef.current)) {
        if (previousFilesMapRef.current[filePath] !== text) {
          rerender = true;
          break;
        }
      }
    }

    if (rerender) {
      setFiles(new Map(Object.entries(filesMapRef.current)));
    }
  }, [onAddFile, onChangeFile, onDeleteFile]);

  const startPollingWatchedDirectories = useCallback(() => {
    intervalRef.current = setInterval(async () => {
      if (isProcessing) {
        return;
      }
      setIsProcessing(true);
      await processWatchedDirectories();
      await processFiles();
      setIsProcessing(false);
    }, props.pollInterval || DEFAULT_POLL_INTERVAL);
  }, [processWatchedDirectories, processFiles, isProcessing]);

  const onDirectorySelection = async () => {
    try {
      // @ts-ignore
      const directoryHandle = await window.showDirectoryPicker();

      if (!directoryHandle) {
        return;
      }

      const initialDirectoryPath = directoryHandle.name;

      watchedDirectoriesRef.current.set(initialDirectoryPath, directoryHandle);

      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }

      startPollingWatchedDirectories();
    } catch (error) {
      console.error(`Error during directory selection:`);
      console.error(error);
    }
  };

  useUnmount(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }
  });

  return {
    handles: handlesRef.current,
    onDirectorySelection,
    files,
    isProcessing,
  };
};

// below is copied from usehooks-ts

const useEffectOnce = (effect: EffectCallback) => {
  useEffect(effect, []);
};

const useUnmount = (fn: () => any): void => {
  const fnRef = useRef(fn);

  // update the ref each render so if it change the newest callback will be invoked
  fnRef.current = fn;

  useEffectOnce(() => () => fnRef.current());
};

// const useIsomorphicLayoutEffect =
//   typeof window !== 'undefined' ? useLayoutEffect : useEffect;

// // eslint-disable-next-line @typescript-eslint/no-unused-vars
// const useInterval = (callback: () => void, delay: number | null) => {
//   const savedCallback = useRef(callback);

//   // Remember the latest callback if it changes.
//   useIsomorphicLayoutEffect(() => {
//     savedCallback.current = callback;
//   }, [callback]);

//   // Set up the interval.
//   useEffect(() => {
//     // Don't schedule if no delay is specified.
//     // Note: 0 is a valid value for delay.
//     if (!delay && delay !== 0) {
//       return;
//     }

//     const id = setInterval(() => savedCallback.current(), delay);

//     // eslint-disable-next-line consistent-return
//     return () => clearInterval(id);
//   }, [delay]);
// };
