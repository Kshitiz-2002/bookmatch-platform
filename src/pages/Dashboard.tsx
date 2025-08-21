import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import {
  BookOpen,
  Upload,
  Star,
  TrendingUp,
  Clock,
  Users,
  Plus,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import BookDetailsModal from "@/components/books/BookDetailsModal";
import { toast } from 'sonner';
import { Progress } from "@/components/ui/progress";
import Layout from "@/components/layout/Layout";
import BookCard from "@/components/books/BookCard";
import { useAuth } from "@/hooks/useAuth";
import { useBooks } from "@/hooks/useBooks";
import { useLibrary } from "@/hooks/useLibrary";
import { useNavigate } from 'react-router-dom';

const Dashboard = () => {
  const { user } = useAuth();
  const { books: recentBooks } = useBooks({
    limit: 6,
    sort: "createdAt",
    order: "desc",
  });
  const { libraryEntries, isLoading: libraryLoading } = useLibrary();

  const [currentlyReading, setCurrentlyReading] = useState(0);
  const [wantToRead, setWantToRead] = useState(0);
  const [completed, setCompleted] = useState(0);

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedGenre, setSelectedGenre] = useState('all');
  const [sortBy, setSortBy] = useState('rating');
  
  const filters = {
    q: searchQuery || undefined,
    genre: selectedGenre === 'all' ? undefined : selectedGenre,
    sort: sortBy,
    order: sortBy === 'rating' ? 'desc' : 'desc',
    publicOnly: true,
    limit: 20
  };
  const { books, isLoading, error, downloadBook } = useBooks(filters);
  const [selectedBookId, setSelectedBookId] = useState<number | null>(null);
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);

  useEffect(() => {
    if (libraryEntries) {
      setCurrentlyReading(
        libraryEntries.filter((item) => item.status === "reading").length
      );
      setWantToRead(
        libraryEntries.filter((item) => item.status === "want-to-read").length
      );
      setCompleted(
        libraryEntries.filter((item) => item.status === "read").length
      );
    }
  }, [libraryEntries]);

  const navigate = useNavigate();
  
  const handleReadBook = (id: number) => {
    navigate(`/read/${id}`);
  };

  const handleDownload = async (id: number) => {
    const book = books.find((b) => b.id === id);
    if (!book) return;

    try {
      await downloadBook(id, book.title);
      toast.success("Download started");
    } catch (error) {
      toast.error("Download failed");
    }
  };

  const handleViewDetails = (id: number) => {
    setSelectedBookId(id);
    setIsDetailsModalOpen(true);
  };

  const stats = [
    {
      title: "Currently Reading",
      value: currentlyReading,
      icon: BookOpen,
      color: "text-blue-600",
      bgColor: "bg-blue-100",
    },
    {
      title: "Want to Read",
      value: wantToRead,
      icon: Clock,
      color: "text-orange-600",
      bgColor: "bg-orange-100",
    },
    {
      title: "Completed",
      value: completed,
      icon: Star,
      color: "text-green-600",
      bgColor: "bg-green-100",
    },
    {
      title: "Total in Library",
      value: libraryEntries?.length || 0,
      icon: Users,
      color: "text-purple-600",
      bgColor: "bg-purple-100",
    },
  ];

  const quickActions = [
    {
      title: "Upload a Book",
      description: "Add a new book to the collection",
      icon: Upload,
      href: "/upload",
      color: "bg-gradient-primary",
    },
    {
      title: "Discover Books",
      description: "Explore new books to read",
      icon: TrendingUp,
      href: "/discover",
      color: "bg-gradient-accent",
    },
    {
      title: "My Library",
      description: "Manage your reading list",
      icon: BookOpen,
      href: "/library",
      color: "bg-gradient-hero",
    },
  ];

  const currentlyReadingBooks =
    libraryEntries?.filter((item) => item.status === "reading").slice(0, 3) ||
    [];

  return (
    <Layout>
      <div className="container mx-auto px-4 py-6 space-y-8">
        {/* Welcome Section */}
        <div className="text-center space-y-4">
          <h1 className="text-3xl sm:text-4xl font-serif font-bold">
            Welcome back, {user?.name}! 📚
          </h1>
          <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
            Ready to continue your reading journey? Here's what's happening in
            your library.
          </p>
        </div>

        {/* Reading Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {stats.map((stat, index) => (
            <Card
              key={index}
              className="hover:shadow-elegant transition-all duration-300"
            >
              <CardContent className="p-4 sm:p-6">
                <div className="flex items-center space-x-3">
                  <div className={`p-2 rounded-lg ${stat.bgColor}`}>
                    <stat.icon className={`h-5 w-5 ${stat.color}`} />
                  </div>
                  <div>
                    <p className="text-2xl sm:text-3xl font-bold">
                      {stat.value}
                    </p>
                    <p className="text-xs sm:text-sm text-muted-foreground">
                      {stat.title}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Quick Actions */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Plus className="h-5 w-5" />
              Quick Actions
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {quickActions.map((action, index) => (
                <Link key={index} to={action.href}>
                  <Card className="group hover:shadow-elegant transition-all duration-300 hover:scale-105 cursor-pointer">
                    <CardContent className="p-4">
                      <div className="flex items-start space-x-3">
                        <div
                          className={`p-2 rounded-lg ${action.color} group-hover:shadow-glow transition-all duration-300`}
                        >
                          <action.icon className="h-5 w-5 text-white" />
                        </div>
                        <div>
                          <h3 className="font-medium group-hover:text-primary transition-colors">
                            {action.title}
                          </h3>
                          <p className="text-sm text-muted-foreground">
                            {action.description}
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Currently Reading */}
        {currentlyReadingBooks.length > 0 && (
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <BookOpen className="h-5 w-5" />
                Continue Reading
              </CardTitle>
              <Button variant="outline" size="sm" asChild>
                <Link to="/library">View All</Link>
              </Button>
            </CardHeader>
            <CardContent>
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {currentlyReadingBooks.map((item) => (
                  <Card
                    key={item.id}
                    className="hover:shadow-elegant transition-all duration-300"
                  >
                    <CardContent className="p-4">
                      <div className="space-y-3">
                        <div className="flex items-start space-x-3">
                          <div className="w-12 h-16 bg-gradient-primary rounded flex-shrink-0 flex items-center justify-center">
                            <BookOpen className="h-6 w-6 text-white" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <h3 className="font-medium line-clamp-2">
                              {item.book.title}
                            </h3>
                            <p className="text-sm text-muted-foreground">
                              by {item.book.author}
                            </p>
                            <Badge variant="secondary" className="mt-1">
                              {item.status.replace("-", " ")}
                            </Badge>
                          </div>
                        </div>

                        {/* Reading Progress */}
                        <div className="space-y-2">
                          <div className="flex justify-between text-sm">
                            <span>Reading Progress</span>
                            <span>45%</span>
                          </div>
                          <Progress value={45} className="h-2" />
                        </div>

                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            className="flex-1"
                            onClick={() => handleReadBook(item.book.id)}
                          >
                            Continue Reading
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Recently Added Books */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Recently Added Books
            </CardTitle>
            <Button variant="outline" size="sm" asChild>
              <Link to="/discover">Explore More</Link>
            </Button>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {recentBooks.slice(0, 6).map((book) => (
                <BookCard
                  key={book.id}
                  book={book}
                  onViewDetails={handleViewDetails}
                  onDownload={handleDownload}
                />
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Reading Goals */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Star className="h-5 w-5" />
              Reading Goals for 2024
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="font-medium">Books Read This Year</span>
                <span className="text-lg font-bold">{completed} / 20</span>
              </div>
              <Progress value={(completed / 20) * 100} className="h-3" />
              <p className="text-sm text-muted-foreground">
                You're {Math.max(0, 20 - completed)} books away from your goal!
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
      <BookDetailsModal
        bookId={selectedBookId}
        isOpen={isDetailsModalOpen}
        onClose={() => {
          setSelectedBookId(null);
          setIsDetailsModalOpen(false);
        }}
        onDownload={handleDownload}
      />
    </Layout>
  );
};

export default Dashboard;
