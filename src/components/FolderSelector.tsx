/**
 * Folder selector component
 * Displays discovered folders and allows user to select one
 */

import { useState, useEffect, useMemo } from 'react';
import { useDiscoverFolders } from '../hooks/useFolders';
import type { FolderInfo } from '../types';

const FOLDER_PREFERENCE_KEY = 'picsift:selectedFolder';

interface FolderSelectorProps {
  onFolderSelected: (folder: FolderInfo) => void;
  onCancel?: () => void;
}

export default function FolderSelector({
  onFolderSelected,
  onCancel,
}: FolderSelectorProps) {
  const [selectedFolder, setSelectedFolder] = useState<FolderInfo | null>(null);
  
  // Use React Query to fetch folders
  const {
    data: foldersData,
    isLoading,
    error: queryError,
    refetch,
  } = useDiscoverFolders(3);

  const folders = useMemo(() => foldersData?.folders ?? [], [foldersData?.folders]);
  const error = queryError
    ? queryError instanceof Error
      ? queryError.message
      : 'Failed to discover folders'
    : null;

  // Check for saved preference when folders load
  useEffect(() => {
    if (folders.length > 0) {
      const saved = localStorage.getItem(FOLDER_PREFERENCE_KEY);
      if (saved) {
        try {
          const savedFolder = JSON.parse(saved) as FolderInfo;
          // Verify saved folder still exists in discovered folders
          const found = folders.find((f) => f.path === savedFolder.path);
          if (found) {
            setSelectedFolder(found);
          }
        } catch {
          // Invalid saved preference, ignore
        }
      }
    }
  }, [folders]);

  const handleSelect = (folder: FolderInfo) => {
    setSelectedFolder(folder);
  };

  const handleStart = () => {
    if (selectedFolder) {
      // Save preference
      localStorage.setItem(
        FOLDER_PREFERENCE_KEY,
        JSON.stringify(selectedFolder),
      );
      onFolderSelected(selectedFolder);
    }
  };

  if (isLoading) {
    return (
      <div className="content-wrap" style={{ width: '100%', textAlign: 'center' }}>
        <p style={{ color: 'var(--text)', margin: 0 }}>Discovering folders with images…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="content-wrap" style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        <div
          style={{
            padding: '1rem',
            backgroundColor: 'var(--error-bg)',
            color: 'var(--error-text)',
            borderRadius: '8px',
            border: '1px solid var(--error-border)',
          }}
        >
          {error}
        </div>
        <button
          type="button"
          className="touch-target-inline"
          onClick={() => void refetch()}
          style={{
            width: '100%',
            fontSize: '1rem',
            fontWeight: 500,
            backgroundColor: 'var(--accent)',
            color: 'white',
            border: 'none',
            borderRadius: '8px',
            cursor: 'pointer',
          }}
        >
          Retry
        </button>
      </div>
    );
  }

  if (folders.length === 0) {
    return (
      <div className="content-wrap" style={{ width: '100%', textAlign: 'center' }}>
        <p style={{ color: 'var(--text)', margin: 0 }}>No folders with images found.</p>
        {onCancel && (
          <button
            type="button"
            className="touch-target-inline"
            onClick={onCancel}
            style={{
              marginTop: '1rem',
              width: '100%',
              maxWidth: '280px',
              fontSize: '1rem',
              backgroundColor: 'var(--bg-elevated)',
              color: 'var(--text-h)',
              border: '1px solid var(--border)',
              borderRadius: '8px',
              cursor: 'pointer',
            }}
          >
            Back
          </button>
        )}
      </div>
    );
  }

  return (
    <div
      className="content-wrap"
      style={{
        width: '100%',
        display: 'flex',
        flexDirection: 'column',
        gap: '1.25rem',
      }}
    >
      <div>
        <h2 style={{ margin: '0 0 0.375rem 0', color: 'var(--text-h)', fontSize: '1.125rem' }}>
          Select a Folder
        </h2>
        <p style={{ margin: 0, color: 'var(--text)', fontSize: '0.9375rem' }}>
          Choose a folder to review photos from. Folders are sorted by number of images.
        </p>
      </div>

      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '0.5rem',
          maxHeight: '50vh',
          minHeight: '120px',
          overflowY: 'auto',
          overflowX: 'hidden',
          border: '1px solid var(--border)',
          borderRadius: '10px',
          padding: '0.5rem',
          WebkitOverflowScrolling: 'touch',
        }}
      >
        {folders.map((folder) => (
          <button
            type="button"
            key={folder.path}
            onClick={() => handleSelect(folder)}
            className="touch-target-inline"
            style={{
              width: '100%',
              padding: '0.875rem 0.75rem',
              textAlign: 'left',
              backgroundColor:
                selectedFolder?.path === folder.path ? 'var(--accent-light)' : 'transparent',
              border:
                selectedFolder?.path === folder.path
                  ? '2px solid var(--accent)'
                  : '1px solid var(--border)',
              borderRadius: '8px',
              cursor: 'pointer',
              transition: 'background-color 0.15s, border-color 0.15s',
            }}
          >
            <div
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                justifyContent: 'space-between',
                alignItems: 'center',
                gap: '0.5rem',
              }}
            >
              <div style={{ minWidth: 0, flex: '1 1 auto' }}>
                <div
                  style={{
                    fontWeight: '600',
                    color: 'var(--text-h)',
                    marginBottom: '0.125rem',
                    fontSize: '0.9375rem',
                  }}
                >
                  {folder.name}
                </div>
                <div
                  style={{
                    fontSize: '0.8125rem',
                    color: 'var(--text)',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {folder.display_path}
                </div>
              </div>
              <div
                style={{
                  flex: '0 0 auto',
                  padding: '0.25rem 0.5rem',
                  backgroundColor: 'var(--bg-secondary)',
                  borderRadius: '8px',
                  fontSize: '0.8125rem',
                  fontWeight: '600',
                  color: 'var(--text-h)',
                }}
              >
                {folder.image_count} {folder.image_count === 1 ? 'image' : 'images'}
              </div>
            </div>
          </button>
        ))}
      </div>

      <div className="actions-row" style={{ marginTop: '0.25rem' }}>
        {onCancel && (
          <button
            type="button"
            className="touch-target-inline"
            onClick={onCancel}
            style={{
              fontSize: '1rem',
              backgroundColor: 'transparent',
              color: 'var(--text)',
              border: '1px solid var(--border)',
              borderRadius: '8px',
              cursor: 'pointer',
            }}
          >
            Cancel
          </button>
        )}
        <button
          type="button"
          className="touch-target-inline"
          onClick={handleStart}
          disabled={!selectedFolder}
          style={{
            fontSize: '1rem',
            fontWeight: '600',
            backgroundColor: selectedFolder ? 'var(--accent)' : 'var(--border)',
            color: selectedFolder ? 'white' : 'var(--text)',
            border: 'none',
            borderRadius: '8px',
            cursor: selectedFolder ? 'pointer' : 'not-allowed',
            opacity: selectedFolder ? 1 : 0.6,
          }}
        >
          Start Session
        </button>
      </div>
    </div>
  );
}
