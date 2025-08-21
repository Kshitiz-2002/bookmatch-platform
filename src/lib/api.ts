// API configuration and utilities for the Bookshelf application
// This file will contain the base API setup and common utilities

const API_BASE_URL = 'http://localhost:4000';

// Auth token management
export const getAuthToken = (): string | null => {
  return localStorage.getItem('accessToken');
};

export const setAuthToken = (token: string): void => {
  localStorage.setItem('accessToken', token);
};

export const removeAuthToken = (): void => {
  localStorage.removeItem('accessToken');
  localStorage.removeItem('refreshToken');
};

export const getRefreshToken = (): string | null => {
  return localStorage.getItem('refreshToken');
};

export const setRefreshToken = (token: string): void => {
  localStorage.setItem('refreshToken', token);
};

// Common fetch wrapper with auth
export const apiRequest = async (
  endpoint: string, 
  options: RequestInit = {}
): Promise<any> => {
  const token = getAuthToken();
  
  const config: RequestInit = {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token && { Authorization: `Bearer ${token}` }),
      ...options.headers,
    },
  };

  const response = await fetch(`${API_BASE_URL}${endpoint}`, config);

  if (response.status === 401) {
    // Token expired, try to refresh
    const refreshToken = getRefreshToken();
    if (refreshToken) {
      try {
        const refreshResponse = await fetch(`${API_BASE_URL}/auth/refresh`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ refreshToken }),
        });

        if (refreshResponse.ok) {
          const { accessToken, refreshToken: newRefreshToken } = await refreshResponse.json();
          setAuthToken(accessToken);
          setRefreshToken(newRefreshToken);
          
          // Retry original request with new token
          const retryConfig = {
            ...config,
            headers: {
              ...config.headers,
              Authorization: `Bearer ${accessToken}`,
            },
          };
          
          const retryResponse = await fetch(`${API_BASE_URL}${endpoint}`, retryConfig);
          return retryResponse.json();
        }
      } catch (error) {
        console.error('Token refresh failed:', error);
        removeAuthToken();
        window.location.href = '/login';
      }
    } else {
      removeAuthToken();
      window.location.href = '/login';
    }
  }

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Network error' }));
    throw new Error(error.error || 'Request failed');
  }

  return response.json();
};

// Authentication API calls
export const authAPI = {
  login: async (email: string, password: string) => {
    const response = await apiRequest('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    
    if (response.accessToken) {
      setAuthToken(response.accessToken);
      setRefreshToken(response.refreshToken);
    }
    
    return response;
  },

  register: async (name: string, email: string, password: string) => {
    const response = await apiRequest('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ name, email, password }),
    });
    
    if (response.accessToken) {
      setAuthToken(response.accessToken);
      setRefreshToken(response.refreshToken);
    }
    
    return response;
  },

  logout: async () => {
    const refreshToken = getRefreshToken();
    if (refreshToken) {
      await apiRequest('/auth/logout', {
        method: 'POST',
        body: JSON.stringify({ refreshToken }),
      });
    }
    removeAuthToken();
  },
};

// Books API calls
export const booksAPI = {
  getBooks: async (params: {
    q?: string;
    genre?: string;
    author?: string;
    publicOnly?: boolean;
    limit?: number;
    offset?: number;
    sort?: string;
    order?: string;
  } = {}) => {
    const searchParams = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined) {
        searchParams.append(key, value.toString());
      }
    });
    
    return apiRequest(`/books?${searchParams}`);
  },

  getBook: async (id: number) => {
    return apiRequest(`/books/${id}`);
  },

  uploadBook: async (formData: FormData) => {
    const token = getAuthToken();
    
    const response = await fetch(`${API_BASE_URL}/books`, {
      method: 'POST',
      headers: {
        ...(token && { Authorization: `Bearer ${token}` }),
        // Don't set Content-Type for FormData
      },
      body: formData,
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Upload failed' }));
      throw new Error(error.error || 'Upload failed');
    }

    return response.json();
  },

  downloadBook: async (id: number) => {
    const token = getAuthToken();
    
    const response = await fetch(`${API_BASE_URL}/books/${id}/download`, {
      headers: {
        ...(token && { Authorization: `Bearer ${token}` }),
      },
    });

    if (!response.ok) {
      throw new Error('Download failed');
    }

    return response.blob();
  },

  rateBook: async (id: number, score: number, review?: string) => {
    return apiRequest(`/books/${id}/rate`, {
      method: 'POST',
      body: JSON.stringify({ score, review }),
    });
  },
};

export const userAPI = {
  getMe: async () => {
    return apiRequest('/users/me');
  },

  updateMe: async (data: { name?: string; password?: string }) => {
    return apiRequest('/users/me', {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  deleteMe: async () => {
    return apiRequest('/users/me', { method: 'DELETE' });
  },
};

// User library API calls
export const libraryAPI = {
  getLibrary: async () => {
    return apiRequest('/users/me/library');
  },

  addToLibrary: async (bookId: number, status: string) => {
    return apiRequest('/users/me/library', {
      method: 'POST',
      body: JSON.stringify({ bookId, status }),
    });
  },

  updateLibraryStatus: async (bookId: number, status: string) => {
    return apiRequest(`/users/me/library/${bookId}`, {
      method: 'PUT',
      body: JSON.stringify({ status }),
    });
  },

  removeFromLibrary: async (bookId: number) => {
    return apiRequest(`/users/me/library/${bookId}`, {
      method: 'DELETE',
    });
  },
};

// Recommendations API calls
export const recommendationsAPI = {
  getRecommendations: async (params: {
    limit?: number;
    seedBooks?: number[];
    publicOnly?: boolean;
  } = {}) => {
    const searchParams = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined) {
        if (key === 'seedBooks' && Array.isArray(value)) {
          searchParams.append(key, value.join(','));
        } else {
          searchParams.append(key, value.toString());
        }
      }
    });
    
    return apiRequest(`/recs?${searchParams}`);
  },
};

export default {
  auth: authAPI,
  books: booksAPI,
  library: libraryAPI,
  user: userAPI,
  recommendations: recommendationsAPI,
};