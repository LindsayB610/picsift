/**
 * Folder selector component
 * Displays discovered folders and allows user to select one
 */

import { useState, useEffect } from 'react';
import { discoverFolders } from '../api';
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
  const [folders, setFolders] = useState<FolderInfo[]>([]);
  const [selectedFolder, setSelectedFolder] = useState<FolderInfo | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void loadFolders();
  }, []);

  const loadFolders = async () => {
    setIsLoading(true);
    setError(null);

    try {
      console.log('[FolderSelector] Starting folder discovery...');
      const response = await discoverFolders(3);
      console.log('[FolderSelector] Received response:', response);
      setFolders(response.folders);

      // Check for saved preference
      const saved = localStorage.getItem(FOLDER_PREFERENCE_KEY);
      if (saved) {
        try {
          const savedFolder = JSON.parse(saved) as FolderInfo;
          // Verify saved folder still exists in discovered folders
          const found = response.folders.find(
            (f) => f.path === savedFolder.path,
          );
          if (found) {
            setSelectedFolder(found);
          }
        } catch {
          // Invalid saved preference, ignore
        }
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Failed to discover folders',
      );
    } finally {
      setIsLoading(false);
    }
  };

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
      <div
        style={{
          maxWidth: '800px',
          margin: '0 auto',
          padding: '2rem',
          textAlign: 'center',
        }}
      >
        <p>Discovering folders with images...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div
        style={{
          maxWidth: '800px',
          margin: '0 auto',
          padding: '2rem',
        }}
      >
        <div
          style={{
            padding: '1rem',
            backgroundColor: 'var(--error-bg, #fee)',
            color: 'var(--error-text, #c33)',
            borderRadius: '6px',
            marginBottom: '1rem',
          }}
        >
          {error}
        </div>
        <button
          onClick={() => {
            void loadFolders();
          }}
          style={{
            padding: '0.75rem 1.5rem',
            fontSize: '1rem',
            backgroundColor: 'var(--accent, #0061ff)',
            color: 'white',
            border: 'none',
            borderRadius: '6px',
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
      <div
        style={{
          maxWidth: '800px',
          margin: '0 auto',
          padding: '2rem',
          textAlign: 'center',
        }}
      >
        <p>No folders with images found.</p>
        {onCancel && (
          <button
            onClick={onCancel}
            style={{
              marginTop: '1rem',
              padding: '0.75rem 1.5rem',
              fontSize: '1rem',
              backgroundColor: 'var(--border, #e5e4e7)',
              color: 'var(--text-h, #08060d)',
              border: 'none',
              borderRadius: '6px',
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
      style={{
        maxWidth: '800px',
        margin: '0 auto',
        padding: '2rem',
        display: 'flex',
        flexDirection: 'column',
        gap: '1.5rem',
      }}
    >
      <div>
        <h2 style={{ margin: '0 0 0.5rem 0', color: 'var(--text-h)' }}>
          Select a Folder
        </h2>
        <p style={{ margin: 0, color: 'var(--text)' }}>
          Choose a folder to review photos from. Folders are sorted by number
          of images.
        </p>
      </div>

      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '0.5rem',
          maxHeight: '60vh',
          overflowY: 'auto',
          border: '1px solid var(--border, #e5e4e7)',
          borderRadius: '6px',
          padding: '0.5rem',
        }}
      >
        {folders.map((folder) => (
          <button
            key={folder.path}
            onClick={() => handleSelect(folder)}
            style={{
              padding: '1rem',
              textAlign: 'left',
              backgroundColor:
                selectedFolder?.path === folder.path
                  ? 'var(--accent-light, #e6f2ff)'
                  : 'transparent',
              border:
                selectedFolder?.path === folder.path
                  ? '2px solid var(--accent, #0061ff)'
                  : '1px solid var(--border, #e5e4e7)',
              borderRadius: '6px',
              cursor: 'pointer',
              transition: 'all 0.2s',
            }}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <div>
                <div
                  style={{
                    fontWeight: '600',
                    color: 'var(--text-h)',
                    marginBottom: '0.25rem',
                  }}
                >
                  {folder.name}
                </div>
                <div
                  style={{
                    fontSize: '0.9rem',
                    color: 'var(--text)',
                  }}
                >
                  {folder.display_path}
                </div>
              </div>
              <div
                style={{
                  padding: '0.25rem 0.75rem',
                  backgroundColor: 'var(--bg-secondary, #f5f5f5)',
                  borderRadius: '12px',
                  fontSize: '0.9rem',
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

      <div
        style={{
          display: 'flex',
          gap: '1rem',
          justifyContent: 'flex-end',
        }}
      >
        {onCancel && (
          <button
            onClick={onCancel}
            style={{
              padding: '0.75rem 1.5rem',
              fontSize: '1rem',
              backgroundColor: 'transparent',
              color: 'var(--text)',
              border: '1px solid var(--border, #e5e4e7)',
              borderRadius: '6px',
              cursor: 'pointer',
            }}
          >
            Cancel
          </button>
        )}
        <button
          onClick={handleStart}
          disabled={!selectedFolder}
          style={{
            padding: '0.75rem 1.5rem',
            fontSize: '1rem',
            fontWeight: '600',
            backgroundColor: selectedFolder
              ? 'var(--accent, #0061ff)'
              : 'var(--border, #e5e4e7)',
            color: selectedFolder ? 'white' : 'var(--text)',
            border: 'none',
            borderRadius: '6px',
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
