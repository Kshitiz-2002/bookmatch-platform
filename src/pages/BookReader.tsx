// BookReader.tsx
import { useState, useEffect, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  Download,
  BookOpen,
  ZoomIn,
  ZoomOut,
  RotateCw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { useBook } from "@/hooks/useBooks";
import { useToast } from "@/hooks/use-toast";
import Layout from "@/components/layout/Layout";
import api from "@/lib/api";

// react-pdf imports
import { Document, Page, pdfjs } from "react-pdf";
pdfjs.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.js`;

const BookReader = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();

  // viewer states
  const [zoom, setZoom] = useState<number>(1.0); // scale (1.0 = 100%)
  const [rotation, setRotation] = useState<number>(0);
  const [isDownloading, setIsDownloading] = useState(false);

  // preview + pdf state
  const [fileUrl, setFileUrl] = useState<string | null>(null);
  const [isPreviewLoading, setIsPreviewLoading] = useState(false);

  // pagination states
  const [numPages, setNumPages] = useState<number>(0);
  const [pageNumber, setPageNumber] = useState<number>(1);

  const bookId = id ? parseInt(id, 10) : 0;
  const { book, isLoading, error } = useBook(bookId);

  // fetch pdf blob and create object URL
  useEffect(() => {
    let objectUrl: string | null = null;
    if (!book) return;

    setIsPreviewLoading(true);
    (async () => {
      try {
        const blob = await api.books.downloadBook(book.id);
        // blob may be a Response-like object; ensure it's a Blob/ArrayBuffer
        // If it's already Blob, skip arrayBuffer step
        const ab =
          (blob as Blob).arrayBuffer !== undefined
            ? await (blob as Blob).arrayBuffer()
            : await blob.arrayBuffer();
        const pdfBlob = new Blob([ab], { type: "application/pdf" });
        objectUrl = URL.createObjectURL(pdfBlob);
        setFileUrl(objectUrl);
      } catch (err) {
        console.error("Preview load error", err);
        setFileUrl(null);
        toast({
          title: "Preview error",
          description: "Could not load preview. Try downloading the file.",
          variant: "destructive",
        });
      } finally {
        setIsPreviewLoading(false);
      }
    })();

    return () => {
      if (objectUrl) URL.revokeObjectURL(objectUrl);
      setFileUrl(null);
      setNumPages(0);
      setPageNumber(1);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [book?.id]);

  const handleDownload = async () => {
    if (!book) return;
    setIsDownloading(true);
    try {
      const blob = await api.books.downloadBook(book.id);
      const ab =
        (blob as Blob).arrayBuffer !== undefined
          ? await (blob as Blob).arrayBuffer()
          : await blob.arrayBuffer();
      const pdfBlob = new Blob([ab], { type: "application/pdf" });
      const url = URL.createObjectURL(pdfBlob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${book.title}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast({
        title: "Download started",
        description: `${book.title} is being downloaded.`,
      });
    } catch (err) {
      console.error("Download failed", err);
      toast({
        title: "Download failed",
        description: "Could not download the book.",
        variant: "destructive",
      });
    } finally {
      setIsDownloading(false);
    }
  };

  const handleZoomIn = () => setZoom((prev) => Math.min(prev + 0.25, 3));
  const handleZoomOut = () => setZoom((prev) => Math.max(prev - 0.25, 0.5));
  const handleRotate = () => setRotation((prev) => (prev + 90) % 360);

  // page button list (sliding window for large numPages)
  const pageButtons = useMemo(() => {
    if (numPages <= 0) return [];
    const maxButtons = 15;
    let start = 1;
    let end = numPages;
    if (numPages > maxButtons) {
      const half = Math.floor(maxButtons / 2);
      start = Math.max(1, pageNumber - half);
      end = Math.min(numPages, start + maxButtons - 1);
      if (end - start + 1 < maxButtons) start = Math.max(1, end - maxButtons + 1);
    }
    const arr: number[] = [];
    for (let i = start; i <= end; i++) arr.push(i);
    return arr;
  }, [numPages, pageNumber]);

  if (isLoading) {
    return (
      <Layout>
        <div className="container mx-auto px-4 py-8">
          <div className="flex items-center justify-center min-h-96">
            <div className="text-center space-y-4">
              <BookOpen className="h-12 w-12 mx-auto text-muted-foreground animate-pulse" />
              <p className="text-muted-foreground">Loading book...</p>
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
    <Layout>
      <div className="container mx-auto px-4 py-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
          <div className="flex items-center gap-4">
            <Button variant="outline" size="icon" onClick={() => navigate(-1)}>
              <ArrowLeft className="h-4 w-4" />
            </Button>

            <div>
              <h1 className="text-xl sm:text-2xl font-serif font-bold">{book.title}</h1>
              <p className="text-muted-foreground">by {book.author}</p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <Button variant="outline" size="sm" onClick={handleZoomOut} disabled={zoom <= 0.5}>
              <ZoomOut className="h-4 w-4" />
            </Button>

            <span className="text-sm text-muted-foreground px-2">{Math.round(zoom * 100)}%</span>

            <Button variant="outline" size="sm" onClick={handleZoomIn} disabled={zoom >= 3}>
              <ZoomIn className="h-4 w-4" />
            </Button>

            <Separator orientation="vertical" className="h-6" />

            <Button variant="outline" size="sm" onClick={handleRotate}>
              <RotateCw className="h-4 w-4" />
            </Button>

            <Button variant="default" size="sm" onClick={handleDownload} disabled={isDownloading}>
              <Download className="h-4 w-4 mr-2" />
              {isDownloading ? "Downloading..." : "Download"}
            </Button>
          </div>
        </div>

        {/* Reader */}
        <Card className="overflow-hidden">
          <div className="h-[calc(100vh-210px)] overflow-auto bg-muted/30 p-4 flex flex-col items-center">
            <div className="w-full max-w-[1000px] bg-white shadow-lg flex items-center justify-center p-4">
              {book.filePath ? (
                fileUrl ? (
                  <div className="w-full" style={{ textAlign: "center" }}>
                    <Document
                      file={fileUrl}
                      onLoadSuccess={(pdf) => {
                        setNumPages(pdf.numPages);
                        // reset pageNumber if needed
                        setPageNumber((cur) => (pdf.numPages >= cur ? cur : pdf.numPages));
                      }}
                      loading={
                        <div className="text-center py-8">
                          <BookOpen className="h-12 w-12 mx-auto text-muted-foreground animate-pulse" />
                          <p className="text-muted-foreground mt-2">Loading PDF…</p>
                        </div>
                      }
                      error={<div className="text-center p-8"><p className="text-muted-foreground">Could not render document.</p></div>}
                    >
                      <Page
                        pageNumber={pageNumber}
                        scale={zoom}
                        rotate={rotation}
                        width={900}
                        className="mx-auto"
                        loading={<div className="py-8">Rendering page…</div>}
                      />
                    </Document>
                  </div>
                ) : (
                  <div className="text-center p-8 space-y-4">
                    <BookOpen className="h-16 w-16 mx-auto text-muted-foreground" />
                    <div>
                      <h3 className="text-lg font-medium">{isPreviewLoading ? "Loading preview…" : "Preview unavailable"}</h3>
                      <p className="text-muted-foreground mt-2">
                        {isPreviewLoading ? "Preparing preview..." : "This book cannot be previewed inline. You can download it."}
                      </p>
                      <Button className="mt-4" onClick={handleDownload} disabled={isDownloading}>
                        <Download className="h-4 w-4 mr-2" />
                        {isDownloading ? "Downloading..." : "Download to Read"}
                      </Button>
                    </div>
                  </div>
                )
              ) : (
                <div className="text-center p-8 space-y-4">
                  <BookOpen className="h-16 w-16 mx-auto text-muted-foreground" />
                  <div>
                    <h3 className="text-lg font-medium">Book Preview</h3>
                    <p className="text-muted-foreground mt-2">This book is available for download but cannot be previewed online.</p>
                    <Button className="mt-4" onClick={handleDownload} disabled={isDownloading}>
                      <Download className="h-4 w-4 mr-2" />
                      {isDownloading ? "Downloading..." : "Download to Read"}
                    </Button>
                  </div>
                </div>
              )}
            </div>

            {/* Page navigation */}
            {numPages > 0 && (
              <div className="w-full max-w-[1000px] mt-4 flex flex-col items-center">
                <div className="flex items-center gap-2 mb-2">
                  <Button variant="outline" size="sm" onClick={() => setPageNumber((p) => Math.max(1, p - 1))} disabled={pageNumber <= 1}>
                    Prev
                  </Button>

                  <div className="text-sm text-muted-foreground px-3">
                    Page {pageNumber} of {numPages}
                  </div>

                  <Button variant="outline" size="sm" onClick={() => setPageNumber((p) => Math.min(numPages, p + 1))} disabled={pageNumber >= numPages}>
                    Next
                  </Button>
                </div>

                <div className="overflow-x-auto w-full py-2">
                  <div className="flex gap-2 px-2">
                    {/* optional quick button to first page */}
                    {pageButtons.length > 0 && pageButtons[0] > 1 && (
                      <>
                        <button onClick={() => setPageNumber(1)} className="min-w-[36px] h-9 px-2 rounded-md border bg-white text-sm text-muted-foreground">1</button>
                        <div className="flex items-center px-2">...</div>
                      </>
                    )}

                    {pageButtons.map((p) => (
                      <button
                        key={p}
                        onClick={() => setPageNumber(p)}
                        className={`min-w-[36px] h-9 px-2 rounded-md border ${p === pageNumber ? "bg-primary text-white border-primary" : "bg-white text-sm text-muted-foreground"}`}
                      >
                        {p}
                      </button>
                    ))}

                    {pageButtons.length > 0 && pageButtons[pageButtons.length - 1] < numPages && (
                      <>
                        <div className="flex items-center px-2">...</div>
                        <button onClick={() => setPageNumber(numPages)} className="min-w-[36px] h-9 px-2 rounded-md border bg-white text-sm text-muted-foreground">{numPages}</button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        </Card>

        {/* Book Info (unchanged) */}
        <Card className="mt-6">
          <div className="p-6">
            <div className="grid md:grid-cols-2 gap-6">
              <div>
                <h3 className="font-semibold mb-2">About this book</h3>
                <p className="text-muted-foreground text-sm">{book.description || "No description available."}</p>
              </div>

              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Author:</span>
                  <span>{book.author}</span>
                </div>

                {book.isbn && (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">ISBN:</span>
                    <span>{book.isbn}</span>
                  </div>
                )}

                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Rating:</span>
                  <span>{book.avgRating ? `${book.avgRating.toFixed(1)}/5` : "Not rated"}</span>
                </div>

                {book.genres && book.genres.length > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Genres:</span>
                    <span>{book.genres.join(", ")}</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </Card>
      </div>
    </Layout>
  );
};

export default BookReader;
