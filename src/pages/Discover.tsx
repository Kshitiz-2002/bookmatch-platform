import { useState } from 'react';
import { Search, Filter, Grid, List, SlidersHorizontal } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import Layout from '@/components/layout/Layout';
import BookCard from '@/components/books/BookCard';
import BookDetailsModal from '@/components/books/BookDetailsModal';
import { useBooks } from '@/hooks/useBooks';
import { toast } from 'sonner';

const Discover = () => {
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedGenre, setSelectedGenre] = useState('all');
  const [sortBy, setSortBy] = useState('rating');
  const [selectedBookId, setSelectedBookId] = useState<number | null>(null);
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);

  const filters = {
    q: searchQuery || undefined,
    genre: selectedGenre === 'all' ? undefined : selectedGenre,
    sort: sortBy,
    order: sortBy === 'rating' ? 'desc' : 'desc',
    publicOnly: true,
    limit: 20
  };

  const { books, isLoading, error, downloadBook } = useBooks(filters);

  const genres = ["all", "Technology", "Business", "Science", "Self-Help", "Fiction", "Non-Fiction"];

  const handleViewDetails = (id: number) => {
    setSelectedBookId(id);
    setIsDetailsModalOpen(true);
  };

  const handleDownload = async (id: number) => {
    const book = books.find(b => b.id === id);
    if (!book) return;

    try {
      await downloadBook(id, book.title);
      toast.success('Download started');
    } catch (error) {
      toast.error('Download failed');
    }
  };

  const handleSearch = () => {
    // Trigger search by updating filters (useBooks will automatically refetch)
  };

  return (
    <Layout>
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-serif font-bold mb-2">Discover Books</h1>
          <p className="text-muted-foreground">
            Explore our collection of books across various genres and topics
          </p>
        </div>

        {/* Search and Filters */}
        <Card className="mb-8">
          <CardContent className="p-6">
            <div className="flex flex-col lg:flex-row gap-4">
              {/* Search */}
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  type="search"
                  placeholder="Search books, authors, or keywords..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>

              {/* Filters */}
              <div className="flex flex-col sm:flex-row gap-4">
                <Select value={selectedGenre} onValueChange={setSelectedGenre}>
                  <SelectTrigger className="w-full sm:w-40">
                    <SelectValue placeholder="Genre" />
                  </SelectTrigger>
                  <SelectContent>
                    {genres.map((genre) => (
                      <SelectItem key={genre} value={genre}>
                        {genre === 'all' ? 'All Genres' : genre}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Select value={sortBy} onValueChange={setSortBy}>
                  <SelectTrigger className="w-full sm:w-40">
                    <SelectValue placeholder="Sort by" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="rating">Highest Rated</SelectItem>
                    <SelectItem value="newest">Newest First</SelectItem>
                    <SelectItem value="oldest">Oldest First</SelectItem>
                    <SelectItem value="title">Title A-Z</SelectItem>
                  </SelectContent>
                </Select>

                <Button variant="outline" size="icon">
                  <SlidersHorizontal className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* View Toggle and Results Count */}
        <div className="flex items-center justify-between mb-6">
          <div className="text-sm text-muted-foreground">
            {isLoading ? (
              'Loading books...'
            ) : error ? (
              <span className="text-destructive">{error}</span>
            ) : (
              <>Showing <span className="font-medium">{books.length}</span> books</>
            )}
          </div>
          
          <div className="flex items-center space-x-2">
            <Button
              variant={viewMode === 'grid' ? 'default' : 'outline'}
              size="icon"
              onClick={() => setViewMode('grid')}
            >
              <Grid className="h-4 w-4" />
            </Button>
            <Button
              variant={viewMode === 'list' ? 'default' : 'outline'}
              size="icon"
              onClick={() => setViewMode('list')}
            >
              <List className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Books Grid/List */}
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        ) : error ? (
          <div className="text-center py-12">
            <p className="text-destructive mb-4">{error}</p>
            <Button onClick={() => window.location.reload()}>Try Again</Button>
          </div>
        ) : books.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-muted-foreground mb-4">No books found matching your criteria.</p>
            <Button onClick={() => {
              setSearchQuery('');
              setSelectedGenre('all');
            }}>Clear Filters</Button>
          </div>
        ) : viewMode === 'grid' ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-6">
            {books.map((book) => (
              <BookCard
                key={book.id}
                book={book}
                onViewDetails={handleViewDetails}
                onDownload={handleDownload}
              />
            ))}
          </div>
        ) : (
          <div className="space-y-4">
            {books.map((book) => (
              <Card key={book.id} className="hover:shadow-elegant transition-all duration-300">
                <CardContent className="p-6">
                  <div className="flex flex-col md:flex-row gap-6">
                    {/* Book Cover Placeholder */}
                    <div className="w-24 h-32 bg-gradient-primary rounded-lg flex-shrink-0 flex items-center justify-center">
                      <div className="text-white text-center text-xs font-medium p-2">
                        {book.title.split(' ').slice(0, 2).join(' ')}
                      </div>
                    </div>

                    {/* Book Info */}
                    <div className="flex-1">
                      <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
                        <div className="flex-1">
                          <h3 className="text-xl font-semibold mb-1">{book.title}</h3>
                          <p className="text-muted-foreground mb-2">by {book.author}</p>
                          {book.description && (
                            <p className="text-sm text-muted-foreground mb-3 line-clamp-2">
                              {book.description}
                            </p>
                          )}
                          
                          <div className="flex flex-wrap gap-2 mb-3">
                            {book.genres.map((genre) => (
                              <Badge key={genre} variant="secondary">
                                {genre}
                              </Badge>
                            ))}
                          </div>

                          <div className="flex items-center space-x-4 text-sm text-muted-foreground">
                            <span>Rating: {book.avgRating ? book.avgRating.toFixed(1) : 'N/A'}/5</span>
                            <span>By {book.uploadedBy?.name || 'Unknown'}</span>
                          </div>
                        </div>

                        <div className="flex flex-col gap-2">
                          <Button size="sm" onClick={() => handleViewDetails(book.id)}>
                            View Details
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => handleDownload(book.id)}>
                            Download
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Load More */}
        {books.length > 0 && (
          <div className="text-center mt-12">
            <Button variant="outline" size="lg">
              Load More Books
            </Button>
          </div>
        )}

        {/* Book Details Modal */}
        <BookDetailsModal
          bookId={selectedBookId}
          isOpen={isDetailsModalOpen}
          onClose={() => {
            setIsDetailsModalOpen(false);
            setSelectedBookId(null);
          }}
          onDownload={handleDownload}
        />
      </div>
    </Layout>
  );
};

export default Discover;