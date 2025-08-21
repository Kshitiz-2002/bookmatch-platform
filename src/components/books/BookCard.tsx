import { Star, Download, User, Calendar, BookOpen, Eye } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useNavigate } from 'react-router-dom';

interface BookCardProps {
  book: {
    id: number;
    title: string;
    author: string;
    avgRating: number;
    genres: string[];
    uploadedBy: {
      name: string;
    };
    createdAt: string;
    coverPath?: string;
  };
  onViewDetails?: (id: number) => void;
  onDownload?: (id: number, title: string) => void;
}

const BookCard = ({ book, onViewDetails, onDownload }: BookCardProps) => {
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };
  const navigate = useNavigate();
  const handleReadBook = (id: number) => {
    navigate(`/read/${id}`);
  };

  const renderStars = (rating: number) => {
    return Array.from({ length: 5 }, (_, i) => (
      <Star
        key={i}
        className={`h-4 w-4 ${
          i < Math.floor(rating)
            ? "text-accent fill-accent"
            : "text-muted-foreground"
        }`}
      />
    ));
  };

  return (
    <Card className="group cursor-pointer overflow-hidden bg-gradient-card shadow-book hover:shadow-glow transition-all duration-500 hover:scale-105">
      <CardContent className="p-0">
        {/* Book Cover */}
        <div className="aspect-[3/4] bg-gradient-to-br from-primary/20 to-accent/20 relative overflow-hidden">
          {book.coverPath ? (
            <img
              src={book.coverPath}
              alt={`${book.title} cover`}
              className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-gradient-primary">
              <div className="text-center text-white p-6">
                <div className="text-2xl font-serif font-bold mb-2 line-clamp-3">
                  {book.title}
                </div>
                <div className="text-sm opacity-90">by {book.author}</div>
              </div>
            </div>
          )}

          {/* Overlay on hover */}
          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center">
            <div className="flex flex-col sm:flex-row gap-2 px-4">
              <Button
                size="sm"
                variant="secondary"
                onClick={() => handleReadBook(book.id)}
              >
                <BookOpen className="h-4 w-4 mr-1" />
                Read
              </Button>
              <Button
                size="sm"
                variant="secondary"
                onClick={(e) => {
                  e.stopPropagation();
                  onViewDetails?.(book.id);
                }}
              >
                <Eye className="h-4 w-4 mr-1" />
                Details
              </Button>
              <Button
                size="sm"
                variant="default"
                className="bg-accent text-white hover:bg-accent/90 focus:ring-accent"
                onClick={(e) => {
                  e.stopPropagation();
                  onDownload?.(book.id, book.title);
                }}
              >
                <Download className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>

        {/* Book Info */}
        <div className="p-3 sm:p-4">
          <h3 className="font-semibold text-base sm:text-lg line-clamp-2 mb-1 group-hover:text-primary transition-colors">
            {book.title}
          </h3>
          <p className="text-muted-foreground text-xs sm:text-sm mb-2 sm:mb-3">
            by {book.author}
          </p>

          {/* Rating */}
          <div className="flex items-center space-x-1 mb-2 sm:mb-3">
            {renderStars(book.avgRating)}
            <span className="text-xs sm:text-sm text-muted-foreground ml-1 sm:ml-2">
              {typeof book.avgRating === "number"
                ? book.avgRating.toFixed(1)
                : "—"}
            </span>
          </div>

          {/* Genres */}
          <div className="flex flex-wrap gap-1 mb-2 sm:mb-3">
            {book.genres.slice(0, 2).map((genre) => (
              <Badge key={genre} variant="secondary" className="text-xs">
                {genre}
              </Badge>
            ))}
            {book.genres.length > 2 && (
              <Badge variant="secondary" className="text-xs">
                +{book.genres.length - 2}
              </Badge>
            )}
          </div>

          {/* Meta Info */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 text-xs text-muted-foreground">
            <div className="flex items-center space-x-1">
              <User className="h-3 w-3" />
              <span className="truncate">{book.uploadedBy?.name || 'Unknown'}</span>
            </div>
            <div className="flex items-center space-x-1">
              <Calendar className="h-3 w-3" />
              <span>{formatDate(book.createdAt)}</span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default BookCard;
