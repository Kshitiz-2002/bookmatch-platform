import { useState, useEffect } from 'react';
import { booksAPI } from '@/lib/api';
import { Book, BookFilters } from '@/types';

export const useBooks = (filters: BookFilters = {}) => {
  const [books, setBooks] = useState<Book[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchBooks = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const response = await booksAPI.getBooks(filters);
      setBooks(response.items || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch books');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchBooks();
  }, [JSON.stringify(filters)]);

  const downloadBook = async (id: number, title: string) => {
    try {
      const blob = await booksAPI.downloadBook(id);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${title}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error('Download failed:', error);
      throw error;
    }
  };

  return {
    books,
    isLoading,
    error,
    refetch: fetchBooks,
    downloadBook
  };
};

export const useBook = (id: number) => {
  const [book, setBook] = useState<Book | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchBook = async () => {
      try {
        setIsLoading(true);
        setError(null);
        const response = await booksAPI.getBook(id);
        setBook(response.book);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to fetch book');
      } finally {
        setIsLoading(false);
      }
    };

    if (id) {
      fetchBook();
    }
  }, [id]);

  const rateBook = async (score: number, review?: string) => {
    try {
      await booksAPI.rateBook(id, score, review);
      // Refetch book to get updated rating
      const response = await booksAPI.getBook(id);
      setBook(response.book);
    } catch (error) {
      console.error('Rating failed:', error);
      throw error;
    }
  };

  return {
    book,
    isLoading,
    error,
    rateBook
  };
};