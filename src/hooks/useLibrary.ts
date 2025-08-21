import { useState, useEffect } from 'react';
import { libraryAPI } from '@/lib/api';
import { LibraryEntry } from '@/types';

export const useLibrary = () => {
  const [libraryEntries, setLibraryEntries] = useState<LibraryEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchLibrary = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const response = await libraryAPI.getLibrary();
      setLibraryEntries(response.items || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch library');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchLibrary();
  }, []);

  const addToLibrary = async (bookId: number, status: string) => {
    try {
      await libraryAPI.addToLibrary(bookId, status);
      await fetchLibrary(); // Refresh library
    } catch (error) {
      console.error('Failed to add to library:', error);
      throw error;
    }
  };

  const updateStatus = async (bookId: number, status: string) => {
    try {
      await libraryAPI.updateLibraryStatus(bookId, status);
      await fetchLibrary(); // Refresh library
    } catch (error) {
      console.error('Failed to update status:', error);
      throw error;
    }
  };

  const removeFromLibrary = async (bookId: number) => {
    try {
      await libraryAPI.removeFromLibrary(bookId);
      await fetchLibrary(); // Refresh library
    } catch (error) {
      console.error('Failed to remove from library:', error);
      throw error;
    }
  };

  return {
    libraryEntries,
    isLoading,
    error,
    addToLibrary,
    updateStatus,
    removeFromLibrary,
    refetch: fetchLibrary
  };
};