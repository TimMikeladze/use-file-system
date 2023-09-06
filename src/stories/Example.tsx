import React from 'react';
import { action } from '@storybook/addon-actions';
import { commonFilters, useWatchDirectory } from '..';

export const Example = () => {
  const { onDirectorySelection, files } = useWatchDirectory({
    filters: commonFilters,
    onFilesAdded: (newFiles, previousFiles) => {
      console.log('onFilesAdded', newFiles, previousFiles);
      action('onFilesAdded');
    },
    onFilesChanged: (changedFiles, previousFiles) => {
      console.log('onFilesChanged', changedFiles, previousFiles);
      action('onFilesChanged');
    },
    onFilesDeleted: (deletedFiles, previousFiles) => {
      console.log('onFilesDeleted', deletedFiles, previousFiles);
      action('onFilesDeleted');
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
