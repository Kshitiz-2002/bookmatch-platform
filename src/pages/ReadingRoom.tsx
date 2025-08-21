import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  Download,
  BookOpen,
  ZoomIn,
  ZoomOut,
  RotateCw,
  Bookmark,
  Settings,
  Moon,
  Sun,
  Type,
  Palette,
  Volume2,
  ChevronLeft,
  ChevronRight,
  Menu,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Slider } from "@/components/ui/slider";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useBook } from "@/hooks/useBooks";
import { useToast } from "@/hooks/use-toast";
import Layout from "@/components/layout/Layout";
import api from "@/lib/api";

const ReadingRoom = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();

  // Reader settings
  const [zoom, setZoom] = useState(100);
  const [rotation, setRotation] = useState(0);
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [fontSize, setFontSize] = useState(16);
  const [fontFamily, setFontFamily] = useState("serif");
  const [lineHeight, setLineHeight] = useState(1.6);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [bookmarks, setBookmarks] = useState<number[]>([]);
  const [isDownloading, setIsDownloading] = useState(false);

  const [fileUrl, setFileUrl] = useState<string | null>(null);
  const [isPreviewLoading, setIsPreviewLoading] = useState(false);
  const [pdfPages, setPdfPages] = useState<string[]>([]);
  const [loadingPdfPages, setLoadingPdfPages] = useState(false);

  const bookId = id ? parseInt(id) : 0;
  const { book, isLoading, error } = useBook(bookId);
  const progressKey = `reading-progress-${bookId}`;

  // Reading progress percentage
  const readingProgress = totalPages > 0 ? (currentPage / totalPages) * 100 : 0;

  const handleDownload = async () => {
    if (!book) return;

    setIsDownloading(true);
    try {
      const blob = await api.books.downloadBook(book.id);
      const ab = await blob.arrayBuffer();
      const pdfBlob = new Blob([ab], { type: "application/pdf" });
      const url = window.URL.createObjectURL(pdfBlob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${book.title}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      toast({
        title: "Download started",
        description: `${book.title} is being downloaded.`,
      });
    } catch (error) {
      console.error("Download failed:", error);
      toast({
        title: "Download failed",
        description: "Could not download the book. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsDownloading(false);
    }
  };

  const handleZoomIn = () => setZoom((prev) => Math.min(prev + 25, 200));
  const handleZoomOut = () => setZoom((prev) => Math.max(prev - 25, 50));
  const handleRotate = () => setRotation((prev) => (prev + 90) % 360);

  const handlePrevPage = () => {
    setCurrentPage((prev) => {
      const newPage = Math.max(prev - 1, 1);
      localStorage.setItem(progressKey, newPage.toString());
      return newPage;
    });
  };

  const handleNextPage = () => {
    setCurrentPage((prev) => {
      const newPage = Math.min(prev + 1, totalPages || prev + 1);
      localStorage.setItem(progressKey, newPage.toString());
      return newPage;
    });
  };

  const toggleBookmark = () => {
    if (bookmarks.includes(currentPage)) {
      setBookmarks((prev) => prev.filter((page) => page !== currentPage));
    } else {
      setBookmarks((prev) => [...prev, currentPage]);
    }
  };

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen();
      setIsFullscreen(true);
    } else {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
  };

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };

    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () =>
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
  }, []);

  // Save current page to localStorage whenever it changes
  useEffect(() => {
    if (!bookId) return;
    localStorage.setItem(progressKey, currentPage.toString());
  }, [currentPage, progressKey, bookId]);

  // Helper: extract page count from PDF ArrayBuffer using simple heuristics (no libraries)
  const extractPageCountFromPDF = (ab: ArrayBuffer): number => {
    try {
      const raw = new TextDecoder().decode(new Uint8Array(ab));
      // Try to find /Count entries and take the largest one (common approach)
      const countMatches = [...raw.matchAll(/\/Count\s+(\d+)/g)].map((m) =>
        parseInt(m[1], 10)
      );
      if (countMatches.length) {
        return Math.max(...countMatches);
      }

      // Fallback: count occurrences of "/Type /Page"
      const pageMatches = raw.match(/\/Type\s*\/Page\b/g) || [];
      if (pageMatches.length) return pageMatches.length;

      // If all else fails, return 0
      return 0;
    } catch (err) {
      console.error("Error while extracting page count:", err);
      return 0;
    }
  };

  // Load PDF and extract pages for navigation (no external libraries)
  useEffect(() => {
    if (!book) return;
    const savedPage = localStorage.getItem(progressKey);
    // We'll set currentPage after we know totalPages so we can validate the saved page

    let objectUrl: string | null = null;
    setIsPreviewLoading(true);
    setLoadingPdfPages(true);

    (async () => {
      try {
        const blob = await api.books.downloadBook(book.id);
        const ab = await blob.arrayBuffer();

        const sig = new TextDecoder().decode(new Uint8Array(ab.slice(0, 5)));
        if (!sig.startsWith("%PDF")) {
          console.error("Preview response not a PDF. signature:", sig);
          throw new Error("Server returned non-PDF content for preview.");
        }

        const pdfBlob = new Blob([ab], { type: "application/pdf" });
        objectUrl = URL.createObjectURL(pdfBlob);
        setFileUrl(objectUrl);

        // Extract page count from the PDF bytes (no external library)
        const pageCount = extractPageCountFromPDF(ab);

        // If extraction failed (0), attempt a very small fallback by loading via iframe and hoping viewer can show — still set 0 so UI shows preview unavailable
        if (pageCount <= 0) {
          console.warn("Could not reliably extract page count from PDF.");
          setTotalPages(0);
          setPdfPages([]);
        } else {
          setTotalPages(pageCount);

          // Generate page URLs for navigation (iframe supports #page= number on many viewers)
          const pages = Array.from({ length: pageCount }, (_, i) => `${objectUrl}#page=${i + 1}`);
          setPdfPages(pages);

          // Restore saved progress if valid, else start at 1
          if (savedPage) {
            const parsed = parseInt(savedPage, 10);
            if (!isNaN(parsed) && parsed >= 1 && parsed <= pageCount) {
              setCurrentPage(parsed);
            } else {
              setCurrentPage(1);
              localStorage.setItem(progressKey, "1");
            }
          } else {
            setCurrentPage(1);
            localStorage.setItem(progressKey, "1");
          }
        }
      } catch (err) {
        console.error("Error loading book preview:", err);
        toast({
          title: "Error loading book",
          description: "Could not load the book. Please try again or download it.",
          variant: "destructive",
        });
        setFileUrl(null);
        setTotalPages(0);
        setPdfPages([]);
      } finally {
        setIsPreviewLoading(false);
        setLoadingPdfPages(false);
      }
    })();

    return () => {
      if (objectUrl) URL.revokeObjectURL(objectUrl);
      setFileUrl(null);
      // keep totalPages if you want the UI to remember it across unmounts, otherwise clear:
      // setTotalPages(0);
      // setPdfPages([]);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [book?.id]);

  // If totalPages changes and currentPage is out of range, clamp it
  useEffect(() => {
    if (totalPages > 0) {
      if (currentPage > totalPages || currentPage < 1) {
        const newPage = Math.min(Math.max(currentPage, 1), totalPages) || 1;
        setCurrentPage(newPage);
        localStorage.setItem(progressKey, newPage.toString());
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [totalPages]);

  if (isLoading) {
    return (
      <Layout>
        <div className="container mx-auto px-4 py-8">
          <div className="flex items-center justify-center min-h-96">
            <div className="text-center space-y-4">
              <BookOpen className="h-12 w-12 mx-auto text-muted-foreground animate-pulse" />
              <p className="text-muted-foreground">Loading reading room...</p>
            </div>
          </div>
        </div>
      </Layout>
    );
  }

  if (error || !book) {
    return (
      <Layout>
        <div className="container mx-auto px-4 py-8">
          <div className="flex items-center justify-center min-h-96">
            <div className="text-center space-y-4">
              <BookOpen className="h-12 w-12 mx-auto text-muted-foreground" />
              <p className="text-muted-foreground">Book not found or access denied.</p>
              <Button onClick={() => navigate("/discover")}>Back to Discover</Button>
            </div>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <div className={`min-h-screen ${isDarkMode ? "dark bg-gray-900 text-white" : "bg-background"}`}>
      {/* Header Controls */}
      <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto px-4">
          <div className="flex h-14 items-center justify-between">
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
                <ArrowLeft className="h-4 w-4" />
              </Button>

              <div className="hidden sm:block">
                <h1 className="text-lg font-semibold truncate max-w-[200px]">{book.title}</h1>
                <p className="text-sm text-muted-foreground">by {book.author}</p>
              </div>
            </div>


            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="icon"
                onClick={toggleBookmark}
                className={bookmarks.includes(currentPage) ? "text-yellow-500" : ""}
              >
                <Bookmark className="h-4 w-4" />
              </Button>

              <Button variant="ghost" size="icon" onClick={() => setIsSettingsOpen(!isSettingsOpen)}>
                {isSettingsOpen ? <X className="h-4 w-4" /> : <Settings className="h-4 w-4" />}
              </Button>
              <Button variant="ghost" size="icon" onClick={toggleFullscreen}>
                <BookOpen className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="icon" onClick={handleDownload} disabled={isDownloading}>
                <Download className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </header>

      <div className="flex">
        {/* Settings Sidebar */}
        {isSettingsOpen && (
          <div className="w-80 border-r bg-background p-6 space-y-6">
            <h3 className="text-lg font-semibold">Reading Settings</h3>

            {/* Display Settings */}
            <div className="space-y-4">
              <h4 className="font-medium">Display</h4>

              <div className="flex items-center justify-between">
                <span className="text-sm">Dark Mode</span>
                <Switch checked={isDarkMode} onCheckedChange={setIsDarkMode} />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Zoom</label>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="icon" onClick={handleZoomOut}>
                    <ZoomOut className="h-4 w-4" />
                  </Button>
                  <span className="text-sm w-12 text-center">{zoom}%</span>
                  <Button variant="outline" size="icon" onClick={handleZoomIn}>
                    <ZoomIn className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Font Family</label>
                <Select value={fontFamily} onValueChange={setFontFamily}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="serif">Serif</SelectItem>
                    <SelectItem value="sans-serif">Sans Serif</SelectItem>
                    <SelectItem value="monospace">Monospace</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Font Size: {fontSize}px</label>
                <Slider value={[fontSize]} onValueChange={(value) => setFontSize(value[0])} min={12} max={24} step={1} />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Line Height: {lineHeight}</label>
                <Slider value={[lineHeight]} onValueChange={(value) => setLineHeight(value[0])} min={1.2} max={2.0} step={0.1} />
              </div>
            </div>

            {/* Navigation */}
            <div className="space-y-4">
              <h4 className="font-medium">Navigation</h4>

              {bookmarks.length > 0 && (
                <div className="space-y-2">
                  <label className="text-sm font-medium">Bookmarks</label>
                  <div className="space-y-1">
                    {bookmarks.map((page) => (
                      <Button
                        key={page}
                        variant="ghost"
                        size="sm"
                        className="w-full justify-start"
                        onClick={() => setCurrentPage(page)}
                      >
                        Page {page}
                      </Button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Main Reading Area */}
        <div className="flex-1 relative">
          {/* Reading Content */}
          <div className="h-[calc(100vh-3.5rem)] overflow-auto bg-muted/30 p-4">
            <div
              className="mx-auto bg-white shadow-2xl min-h-full flex items-center justify-center relative"
              style={{
                width: `${zoom}%`,
                transform: `rotate(${rotation}deg)`,
                transition: "all 0.3s ease",
                fontFamily: fontFamily,
                fontSize: `${fontSize}px`,
                lineHeight: lineHeight,
              }}
            >
              {book.filePath ? (
                <div className="w-full h-full p-8">
                  <div className="max-w-4xl mx-auto space-y-6">
                    <div className="space-y-4 text-justify leading-relaxed">
                      {fileUrl && totalPages > 0 ? (
                        <div className="relative">
                          <iframe
                            src={pdfPages[currentPage - 1] || `${fileUrl}#page=${currentPage}`}
                            className="w-full h-[80vh] border rounded-lg shadow-book"
                            style={{
                              backgroundColor: isDarkMode ? "#111" : "#fff",
                            }}
                            title={`${book.title} - Page ${currentPage}`}
                          />
                          {/* page controls */}
                          
                        </div>
                      ) : (
                        <div className="text-center text-muted-foreground py-20">
                          {isPreviewLoading ? (
                            <div className="space-y-4">
                              <BookOpen className="h-16 w-16 mx-auto animate-pulse" />
                              <div>Loading book and extracting pages...</div>
                            </div>
                          ) : (
                            "Preview unavailable — please download."
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-center p-8 space-y-4">
                  <BookOpen className="h-16 w-16 mx-auto text-muted-foreground" />
                  <div>
                    <h3 className="text-lg font-medium">Book Preview</h3>
                    <p className="text-muted-foreground mt-2">
                      This book is available for download but cannot be previewed online.
                    </p>
                    <Button className="mt-4" onClick={handleDownload} disabled={isDownloading}>
                      <Download className="h-4 w-4 mr-2" />
                      {isDownloading ? "Downloading..." : "Download to Read"}
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ReadingRoom;
