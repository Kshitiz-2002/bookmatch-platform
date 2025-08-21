import { useState } from "react";
import { Star, Download, Calendar, User, BookOpen, Heart } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { useBook } from "@/hooks/useBooks";
import { useLibrary } from "@/hooks/useLibrary";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";

interface BookDetailsModalProps {
  bookId: number | null;
  isOpen: boolean;
  onClose: () => void;
  onDownload?: (id: number, title: string) => void;
}

const BookDetailsModal = ({
  bookId,
  isOpen,
  onClose,
  onDownload,
}: BookDetailsModalProps) => {
  const [userRating, setUserRating] = useState(0);
  const [review, setReview] = useState("");
  const [isSubmittingRating, setIsSubmittingRating] = useState(false);

  const { book, isLoading, rateBook } = useBook(bookId || 0);
  const { addToLibrary } = useLibrary();

  if (!bookId) return null;
  const { user: authUser } = useAuth();

  const handleRating = async () => {
    if (userRating === 0) {
      toast.error("Please select a rating");
      return;
    }

    try {
      setIsSubmittingRating(true);

      if (book && authUser) {
        // optimistic rating with a negative ID
        book.ratings = [
          {
            id: Date.now() * -1, // temp numeric ID
            score: userRating,
            review,
            createdAt: new Date().toISOString(),
            userId: authUser.id,
            user: { id: authUser.id, name: authUser.name },
          },
          ...book.ratings,
        ];
      }

      await rateBook(userRating, review);

      toast.success("Rating submitted successfully!");
      setUserRating(0);
      setReview("");
    } catch (error) {
      toast.error("Failed to submit rating");
    } finally {
      setIsSubmittingRating(false);
    }
  };

  const handleAddToLibrary = async (status: string) => {
    try {
      await addToLibrary(bookId, status);
      toast.success(`Added to library as "${status.replace("-", " ")}"`);
    } catch (error) {
      toast.error("Failed to add to library");
    }
  };

  const renderStars = (
    rating: number,
    interactive = false,
    onRatingChange?: (rating: number) => void
  ) => {
    return Array.from({ length: 5 }, (_, i) => (
      <Star
        key={i}
        className={`h-5 w-5 cursor-pointer transition-colors ${
          i < rating
            ? "text-accent fill-accent"
            : "text-muted-foreground hover:text-accent"
        }`}
        onClick={() => interactive && onRatingChange?.(i + 1)}
      />
    ));
  };

  if (isLoading) {
    return (
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="max-w-2xl">
          <div className="flex items-center justify-center p-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  if (!book) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl font-serif">
            {book.title}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Book Cover and Basic Info */}
          <div className="flex flex-col md:flex-row gap-6">
            <div className="w-48 h-64 bg-gradient-primary rounded-lg flex-shrink-0 flex items-center justify-center mx-auto md:mx-0">
              {book.coverPath ? (
                <img
                  src={book.coverPath}
                  alt={`${book.title} cover`}
                  className="w-full h-full object-cover rounded-lg"
                />
              ) : (
                <div className="text-white text-center p-4">
                  <div className="text-lg font-serif font-bold mb-2">
                    {book.title}
                  </div>
                  <div className="text-sm opacity-90">by {book.author}</div>
                </div>
              )}
            </div>

            <div className="flex-1 space-y-4">
              <div>
                <h3 className="text-xl font-semibold">{book.title}</h3>
                <p className="text-muted-foreground">by {book.author}</p>
              </div>

              {book.description && (
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {book.description}
                </p>
              )}

              <div className="flex items-center space-x-4 text-sm">
                <div className="flex items-center space-x-1">
                  {renderStars(book.avgRating || 0)}
                  <span className="ml-1 font-medium">
                    {book.avgRating?.toFixed(1) || "No ratings"}
                  </span>
                </div>
                {book.ratings && book.ratings.length > 0 && (
                  <span className="text-muted-foreground">
                    ({book.ratings.length} reviews)
                  </span>
                )}
              </div>

              <div className="flex flex-wrap gap-2">
                {book.genres?.map((genre) => (
                  <Badge key={genre} variant="secondary">
                    {genre}
                  </Badge>
                ))}
              </div>

              <div className="flex items-center space-x-4 text-sm text-muted-foreground">
                <div className="flex items-center space-x-1">
                  <User className="h-4 w-4" />
                  <span>Uploaded by {book.uploadedBy?.name || "Unknown"}</span>
                </div>
                <div className="flex items-center space-x-1">
                  <Calendar className="h-4 w-4" />
                  <span>{new Date(book.createdAt).toLocaleDateString()}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap gap-3">
            <Button
              onClick={() => onDownload?.(book.id, book.title)}
              className="flex items-center space-x-2"
            >
              <Download className="h-4 w-4" />
              <span>Download</span>
            </Button>

            <Button
              variant="outline"
              onClick={() => handleAddToLibrary("want-to-read")}
              className="flex items-center space-x-2"
            >
              <Heart className="h-4 w-4" />
              <span>Want to Read</span>
            </Button>

            <Button
              variant="outline"
              onClick={() => handleAddToLibrary("reading")}
              className="flex items-center space-x-2"
            >
              <BookOpen className="h-4 w-4" />
              <span>Currently Reading</span>
            </Button>
          </div>

          {/* Rating Section */}
          <div className="border-t pt-6">
            <h4 className="text-lg font-semibold mb-4">Rate this Book</h4>
            <div className="space-y-4">
              <div className="flex items-center space-x-2">
                <span className="text-sm">Your rating:</span>
                <div className="flex space-x-1">
                  {renderStars(userRating, true, setUserRating)}
                </div>
              </div>

              <Textarea
                placeholder="Write a review (optional)"
                value={review}
                onChange={(e) => setReview(e.target.value)}
                rows={3}
              />

              <Button
                onClick={handleRating}
                disabled={isSubmittingRating || userRating === 0}
                size="sm"
              >
                {isSubmittingRating ? "Submitting..." : "Submit Rating"}
              </Button>
            </div>
          </div>

          {/* Reviews */}
          {book.ratings && book.ratings.length > 0 && (
            <div className="border-t pt-6">
              <h4 className="text-lg font-semibold mb-4">Reviews</h4>
              <div className="space-y-4 max-h-64 overflow-y-auto">
                {book.ratings.map((rating) => (
                  <div key={rating.id} className="border rounded-lg p-4">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center space-x-2">
                        <span className="font-medium text-sm">
                          {rating.user?.name ||
                            (authUser?.id === rating.userId
                              ? authUser.name
                              : "Anonymous")}
                        </span>
                        <div className="flex">{renderStars(rating.score)}</div>
                      </div>
                      <span className="text-xs text-muted-foreground">
                        {new Date(rating.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                    {rating.review && (
                      <p className="text-sm text-muted-foreground">
                        {rating.review}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default BookDetailsModal;
