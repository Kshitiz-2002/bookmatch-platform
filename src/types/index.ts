// Type definitions for the Bookshelf application

export interface User {
  id: number;
  email: string;
  name: string;
  role?: 'USER' | 'ADMIN';
  createdAt: string;
}

export interface Book {
  id: number;
  title: string;
  author: string;
  description?: string;
  isbn?: string;
  filePath: string;
  coverPath?: string;
  isPublic: boolean;
  uploadedById: number;
  uploadedBy: {
    id: number;
    name: string;
  };
  genres: string[];
  avgRating: number;
  ratings?: Rating[];
  createdAt: string;
  metadata?: Record<string, any>;
}

export interface Rating {
  id: number;
  userId: number;
  bookId: number;
  score: number;
  review?: string;
  createdAt: string;
  user?: {
    id: number;
    name: string;
  };
}

export interface LibraryEntry {
  id: number;
  userId: number;
  bookId: number;
  status: 'want-to-read' | 'reading' | 'read' | 'paused';
  createdAt: string;
  book: Book;
}

export interface Recommendation {
  book: Book;
  score: number;
  reason: string;
}

export interface Genre {
  id: number;
  name: string;
}

export interface AuthResponse {
  accessToken: string;
  refreshToken: string;
  user: User;
}

export interface BookFilters {
  q?: string;
  genre?: string;
  author?: string;
  publicOnly?: boolean;
  limit?: number;
  offset?: number;
  sort?: string;
  order?: string;
}

export interface ApiError {
  error: string;
  details?: string;
  statusCode?: number;
}