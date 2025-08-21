import { useState } from "react";
import {
  Book,
  Clock,
  CheckCircle,
  Pause,
  Eye,
  Download,
  BookOpen,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import Layout from "@/components/layout/Layout";
import BookDetailsModal from "@/components/books/BookDetailsModal";
import { useLibrary } from "@/hooks/useLibrary";
import { useBooks } from "@/hooks/useBooks";
import { toast } from "sonner";
import { useNavigate } from 'react-router-dom';

const Library = () => {
  const [activeTab, setActiveTab] = useState("all");
  const [selectedBookId, setSelectedBookId] = useState<number | null>(null);
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);

  const { libraryEntries, isLoading, error, updateStatus, removeFromLibrary } =
    useLibrary();
  const { downloadBook } = useBooks();

  const navigate = useNavigate();
  const getStatusIcon = (status: string) => {
    switch (status) {
      case "reading":
        return <Book className="h-4 w-4 text-blue-500" />;
      case "want-to-read":
        return <Clock className="h-4 w-4 text-orange-500" />;
      case "read":
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case "paused":
        return <Pause className="h-4 w-4 text-gray-500" />;
      default:
        return <Book className="h-4 w-4" />;
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case "reading":
        return "Currently Reading";
      case "want-to-read":
        return "Want to Read";
      case "read":
        return "Finished";
      case "paused":
        return "Paused";
      default:
        return status;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "reading":
        return "bg-blue-100 text-blue-800";
      case "want-to-read":
        return "bg-orange-100 text-orange-800";
      case "read":
        return "bg-green-100 text-green-800";
      case "paused":
        return "bg-gray-100 text-gray-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const handleViewDetails = (id: number) => {
    setSelectedBookId(id);
    setIsDetailsModalOpen(true);
  };

  const handleReadBook = (id: number) => {
    navigate(`/read/${id}`);
  };

  const handleDownload = async (bookId: number, title: string) => {
    try {
      await downloadBook(bookId, title);
      toast.success("Download started");
    } catch (error) {
      toast.error("Download failed");
    }
  };

  const handleStatusChange = async (bookId: number, newStatus: string) => {
    try {
      await updateStatus(bookId, newStatus);
      toast.success(`Status updated to "${newStatus.replace("-", " ")}"`);
    } catch (error) {
      toast.error("Failed to update status");
    }
  };

  const handleRemoveFromLibrary = async (bookId: number) => {
    if (
      confirm("Are you sure you want to remove this book from your library?")
    ) {
      try {
        await removeFromLibrary(bookId);
        toast.success("Book removed from library");
      } catch (error) {
        toast.error("Failed to remove book");
      }
    }
  };

  const filterBooks = (status: string) => {
    if (status === "all") return libraryEntries;
    return libraryEntries.filter((item) => item.status === status);
  };

  const statusCounts = {
    all: libraryEntries.length,
    reading: libraryEntries.filter((item) => item.status === "reading").length,
    "want-to-read": libraryEntries.filter(
      (item) => item.status === "want-to-read"
    ).length,
    read: libraryEntries.filter((item) => item.status === "read").length,
    paused: libraryEntries.filter((item) => item.status === "paused").length,
  };

  return (
    <Layout>
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-serif font-bold mb-2">My Library</h1>
          <p className="text-muted-foreground">
            Manage your personal book collection and reading progress
          </p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
          <Card className="text-center">
            <CardContent className="p-4">
              <div className="text-2xl font-bold text-primary">
                {statusCounts.all}
              </div>
              <div className="text-sm text-muted-foreground">Total Books</div>
            </CardContent>
          </Card>
          <Card className="text-center">
            <CardContent className="p-4">
              <div className="text-2xl font-bold text-blue-600">
                {statusCounts.reading}
              </div>
              <div className="text-sm text-muted-foreground">Reading</div>
            </CardContent>
          </Card>
          <Card className="text-center">
            <CardContent className="p-4">
              <div className="text-2xl font-bold text-orange-600">
                {statusCounts["want-to-read"]}
              </div>
              <div className="text-sm text-muted-foreground">Want to Read</div>
            </CardContent>
          </Card>
          <Card className="text-center">
            <CardContent className="p-4">
              <div className="text-2xl font-bold text-green-600">
                {statusCounts.read}
              </div>
              <div className="text-sm text-muted-foreground">Finished</div>
            </CardContent>
          </Card>
          <Card className="text-center">
            <CardContent className="p-4">
              <div className="text-2xl font-bold text-gray-600">
                {statusCounts.paused}
              </div>
              <div className="text-sm text-muted-foreground">Paused</div>
            </CardContent>
          </Card>
        </div>

        {/* Books by Status */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="all">All ({statusCounts.all})</TabsTrigger>
            <TabsTrigger value="reading">
              Reading ({statusCounts.reading})
            </TabsTrigger>
            <TabsTrigger value="want-to-read">
              Want to Read ({statusCounts["want-to-read"]})
            </TabsTrigger>
            <TabsTrigger value="read">
              Finished ({statusCounts.read})
            </TabsTrigger>
            <TabsTrigger value="paused">
              Paused ({statusCounts.paused})
            </TabsTrigger>
          </TabsList>

          {["all", "reading", "want-to-read", "read", "paused"].map(
            (status) => (
              <TabsContent key={status} value={status} className="mt-6">
                {isLoading ? (
                  <div className="flex items-center justify-center py-12">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                  </div>
                ) : error ? (
                  <div className="text-center py-12">
                    <p className="text-destructive mb-4">{error}</p>
                  </div>
                ) : (
                  <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {filterBooks(status).map((item) => (
                      <Card
                        key={item.id}
                        className="group hover:shadow-elegant transition-all duration-300 hover:scale-105 bg-gradient-card"
                      >
                        <CardHeader className="pb-3">
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <CardTitle className="text-lg line-clamp-2 group-hover:text-primary transition-colors">
                                {item.book.title}
                              </CardTitle>
                              <p className="text-muted-foreground text-sm mt-1">
                                by {item.book.author}
                              </p>
                            </div>
                            <div className="ml-2">
                              {getStatusIcon(item.status)}
                            </div>
                          </div>
                        </CardHeader>

                        <CardContent className="space-y-4">
                          {/* Status Badge */}
                          <div className="flex items-center justify-between">
                            <Badge className={getStatusColor(item.status)}>
                              {getStatusLabel(item.status)}
                            </Badge>
                            <div className="flex items-center space-x-1 text-sm text-muted-foreground">
                              <span>★ {item.book.avgRating}</span>
                            </div>
                          </div>

                          {/* Genres */}
                          <div className="flex flex-wrap gap-1">
                            {item.book.genres.map((genre) => (
                              <Badge
                                key={genre}
                                variant="secondary"
                                className="text-xs"
                              >
                                {genre}
                              </Badge>
                            ))}
                          </div>

                          {/* Status Change */}
                          <div className="flex space-x-2 mb-2">
                            <Select
                              value={item.status}
                              onValueChange={(newStatus) =>
                                handleStatusChange(item.book.id, newStatus)
                              }
                            >
                              <SelectTrigger className="flex-1 h-8">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="want-to-read">
                                  Want to Read
                                </SelectItem>
                                <SelectItem value="reading">Reading</SelectItem>
                                <SelectItem value="read">Finished</SelectItem>
                                <SelectItem value="paused">Paused</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>

                          {/* Actions */}
                          <div className="flex space-x-2">
                            <Button
                              size="sm"
                              variant="outline"
                              className="flex-1"
                              onClick={() => handleViewDetails(item.book.id)}
                            >
                              <Eye className="h-4 w-4 mr-1" />
                              View
                            </Button>
                            <Button
                              size="sm"
                              className="flex-1"
                              onClick={() => handleReadBook(item.book.id)}
                            >
                              <BookOpen className="h-4 w-4 mr-1" />
                              Read
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() =>
                                handleDownload(item.book.id, item.book.title)
                              }
                            >
                              <Download className="h-4 w-4" />
                            </Button>
                          </div>

                          {/* Date Added */}
                          <div className="text-xs text-muted-foreground">
                            Added{" "}
                            {new Date(item.createdAt).toLocaleDateString()}
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}

                {filterBooks(status).length === 0 && !isLoading && (
                  <Card className="text-center py-12">
                    <CardContent>
                      <Book className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                      <h3 className="text-lg font-semibold mb-2">
                        No books found
                      </h3>
                      <p className="text-muted-foreground mb-4">
                        {status === "all"
                          ? "You haven't added any books to your library yet."
                          : `You don't have any books with "${getStatusLabel(
                              status
                            )}" status.`}
                      </p>
                      <Button asChild>
                        <a href="/discover">Discover Books</a>
                      </Button>
                    </CardContent>
                  </Card>
                )}
              </TabsContent>
            )
          )}
        </Tabs>

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

export default Library;
