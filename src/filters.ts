/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable no-restricted-syntax */
/* eslint-disable no-undef */
import ignore from 'ignore';

export type Filter = {
  shouldIncludeFile: (
    filepath: string,
    handle: FileSystemFileHandle
  ) => Promise<boolean>;
  shouldProcessDirectory: (
    filepath: string,
    handle: FileSystemDirectoryHandle
  ) => Promise<boolean>;
};

export type FilterFn = () => Promise<Filter>;

export const gitFilter: FilterFn = async () => {
  const ig = ignore({
    allowRelativePaths: true,
  });

  // TODO support multiple gitignore files
  let gitIgnoreLoaded = false;

  return {
    shouldIncludeFile: async (
      filepath: string,
      handle: FileSystemFileHandle
    ) => {
      if (filepath.endsWith(`.gitignore`) && !gitIgnoreLoaded) {
        const file = await (handle as FileSystemFileHandle).getFile();
        const text = await file.text();
        ig.add(text);
        gitIgnoreLoaded = true;
        return false;
      }
      const { ignored } = ig.test(filepath);

      return !ignored;
    },
    shouldProcessDirectory: async (
      filepath: string,
      handle: FileSystemDirectoryHandle
    ) => {
      const { ignored } = ig.test(filepath);

      if (filepath.endsWith(`.git`)) {
        return false;
      }

      if (filepath.includes('.git/')) {
        return false;
      }

      return !ignored;
    },
  };
};

export const distFilter: FilterFn = async () => {
  const isDist = (filepath: string) => {
    if (filepath.includes(`/dist/`)) {
      return true;
    }
    if (filepath.includes(`/out/`)) {
      return true;
    }
    if (filepath.includes(`/build/`)) {
      return true;
    }
    if (filepath.includes(`/vendor/`)) {
      return true;
    }
    if (filepath.includes(`/node_modules/`)) {
      return true;
    }
    if (filepath.includes(`/.next/`)) {
      return true;
    }
    return false;
  };
  return {
    shouldIncludeFile: async (
      filepath: string,
      handle: FileSystemFileHandle
    ) => {
      if (isDist(filepath)) {
        return false;
      }
      return true;
    },
    shouldProcessDirectory: async (
      filepath: string,
      handle: FileSystemDirectoryHandle
    ) => {
      if (isDist(filepath)) {
        return false;
      }
      return true;
    },
  };
};

export const miscFilter: FilterFn = async () => {
  const isMisc = (filepath: string) => {
    if (filepath.endsWith(`.DS_Store`)) {
      return true;
    }
    return false;
  };
  return {
    shouldIncludeFile: async (
      filepath: string,
      handle: FileSystemFileHandle
    ) => {
      if (isMisc(filepath)) {
        return false;
      }
      return true;
    },
    shouldProcessDirectory: async (
      filepath: string,
      handle: FileSystemDirectoryHandle
    ) => {
      if (isMisc(filepath)) {
        return false;
      }
      return true;
    },
  };
};

export const commonFilters = [distFilter, miscFilter, gitFilter];
