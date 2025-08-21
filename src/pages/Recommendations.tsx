import { useState, useEffect } from "react";
import { Sparkles, RefreshCw, TrendingUp, Heart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import Layout from "@/components/layout/Layout";
import BookCard from "@/components/books/BookCard";
import { recommendationsAPI } from "@/lib/api";

type RecRaw = Record<string, any>;

const Recommendations = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState("for-you");

  const [recommendations, setRecommendations] = useState<Record<string, any[]>>({
    "for-you": [],
    trending: [],
    "community-picks": [],
  });

  useEffect(() => {
    const fetchRecs = async () => {
      setIsLoading(true);
      try {
        const data = await recommendationsAPI.getRecommendations({
          limit: 10,
          // type: activeTab
        });

        let items: any[] = [];
        if (Array.isArray(data?.items)) items = data.items;
        else if (Array.isArray(data?.recommendations)) items = data.recommendations;
        else if (Array.isArray(data)) items = data;
        else items = [];

        setRecommendations((prev) => ({
          ...prev,
          [activeTab]: items,
        }));
      } catch (err) {
        console.error("Failed to fetch recommendations:", err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchRecs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);

  useEffect(() => {
    console.log("Updated recommendations:", recommendations);
  }, [recommendations]);

  // Helper: extract numeric score from raw item
  const extractRawScore = (raw: RecRaw): number => {
    if (!raw) return 0;

    const candidates = [
      raw.score,
      raw.match,
      raw.score_percent,
      raw.scorePercent,
      raw.match_score,
      raw.matchPercent,
      raw.match_percent,
      raw.match_score_percent,
      raw.match_score_percent,
      raw.scorePercentRaw,
      raw.matchPercentRaw,
    ];

    let val: number | null = null;

    for (const c of candidates) {
      if (c === undefined || c === null) continue;
      // if string like "142%" remove %
      if (typeof c === "string") {
        const cleaned = c.trim().replace("%", "");
        const parsed = parseFloat(cleaned);
        if (!Number.isNaN(parsed)) {
          val = parsed;
          break;
        }
      } else if (typeof c === "number") {
        val = c;
        break;
      }
    }

    if (val === null) return 0;

    // If fraction (0..1), treat as percentage fraction and convert to 0..100
    if (val > 0 && val <= 1) return val * 100;

    // If already like 0..100 or >100, return as-is (we'll normalize later)
    return val;
  };

  // Minimal safe mapper to the exact BookCard props
  const mapToBookCard = (raw: RecRaw) => {
    const idCandidate =
      raw?.id ?? raw?.bookId ?? raw?._id ?? raw?.itemId ?? raw?.book?.id;
    const id = Number.isFinite(Number(idCandidate)) ? Number(idCandidate) : 0;

    const title =
      raw?.title ??
      raw?.name ??
      raw?.book?.title ??
      (raw?.metadata && raw.metadata.title) ??
      "Untitled";

    const author =
      raw?.author ??
      (Array.isArray(raw?.authors) ? raw.authors.join(", ") : undefined) ??
      raw?.book?.author ??
      "Unknown";

    const avgRating =
      typeof raw?.avgRating === "number"
        ? raw.avgRating
        : typeof raw?.rating === "number"
        ? raw.rating
        : Number(raw?.avg_rating) || 0;

    const genres = Array.isArray(raw?.genres)
      ? raw.genres
      : Array.isArray(raw?.categories)
      ? raw.categories
      : [];

    const uploadedBy = raw?.uploadedBy?.name
      ? { name: raw.uploadedBy.name }
      : raw?.uploader
      ? { name: raw.uploader }
      : raw?.source
      ? { name: raw.source }
      : { name: "Unknown" };

    const createdAt =
      raw?.createdAt ||
      raw?.created_at ||
      raw?.publishedAt ||
      raw?.book?.createdAt ||
      new Date().toISOString();

    const coverPath =
      raw?.coverPath ?? raw?.coverUrl ?? raw?.cover_url ?? raw?.thumbnail ?? undefined;

    return {
      id,
      title: String(title),
      author: String(author),
      avgRating: Number(avgRating) || 0,
      genres,
      uploadedBy,
      createdAt: String(createdAt),
      coverPath,
    };
  };

  const handleViewDetails = (id: number) => {
    console.log("View details for book:", id);
    // navigation/modal logic...
  };

  const handleDownload = (id: number, title?: string) => {
    console.log("Download book:", id, title);
    // download logic...
  };

  // Render helper that normalizes scores (by tab) and filters to > 50%
  const renderRecommendations = (tab: string) => {
    const rawItems: RecRaw[] = recommendations[tab] ?? [];

    if (isLoading) {
      return (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="space-y-3 animate-pulse">
              <div className="aspect-[3/4] rounded-md bg-slate-200" />
              <div className="h-4 bg-slate-200 rounded w-3/4" />
              <div className="h-3 bg-slate-200 rounded w-1/2" />
            </div>
          ))}
        </div>
      );
    }

    if (!rawItems.length) {
      return <div className="text-center py-12">No recommendations found.</div>;
    }

    // 1) Extract raw numeric scores (converted to percent where necessary)
    const scores = rawItems.map((r) => {
      const s = extractRawScore(r);
      // ensure non-negative
      return Number.isFinite(s) && s > 0 ? s : 0;
    });

    // 2) Find max to normalize against (avoid divide by zero)
    const maxScore = Math.max(...scores, 0);
    if (maxScore <= 0) {
      // all scores are zero or invalid => nothing to show (user wanted to remove 0% items)
      return <div className="text-center py-12">No recommendations above 50% match.</div>;
    }

    // 3) Normalize and pair items with normalized score
    const itemsWithNormalized = rawItems
      .map((raw, idx) => {
        const rawScore = scores[idx] ?? 0;
        const normalized = (rawScore / maxScore) * 100; // maps max->100
        return {
          raw,
          normalized,
        };
      })
      // 4) Filter: keep only strictly greater than 50% (user asked "above 50%")
      .filter((it) => Number.isFinite(it.normalized) && it.normalized > 50)
      // 5) Sort descending by normalized score (optional, keeps best first)
      .sort((a, b) => b.normalized - a.normalized);

    if (!itemsWithNormalized.length) {
      return <div className="text-center py-12">No recommendations above 50% match.</div>;
    }

    return (
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
        {itemsWithNormalized.map((entry, idx) => {
          const { raw, normalized } = entry;
          const book = mapToBookCard(raw);

          const key = book.id && book.id !== 0 ? book.id : `${tab}-${idx}`;

          return (
            <div key={key} className="space-y-3">
              <BookCard
                book={book}
                onViewDetails={() => handleViewDetails(book.id)}
                onDownload={(id: number, title: string) => handleDownload(id, title)}
              />
              <div className="px-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-accent font-medium">
                    {`${Math.round(normalized)}% match`}
                  </span>
                  <span className="text-muted-foreground">
                    {book.avgRating ? `★ ${book.avgRating.toFixed(1)}` : ""}
                  </span>
                </div>
                {raw?.reason && (
                  <p className="text-xs text-muted-foreground mt-1">{raw.reason}</p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  const getTabIcon = (tab: string) => {
    switch (tab) {
      case "for-you":
        return <Heart className="h-4 w-4" />;
      case "trending":
        return <TrendingUp className="h-4 w-4" />;
      case "community-picks":
        return <Sparkles className="h-4 w-4" />;
      default:
        return null;
    }
  };

  const refreshRecommendations = async () => {
    setIsLoading(true);
    try {
      const data = await recommendationsAPI.getRecommendations({ limit: 10 });
      let items: any[] = [];
      if (Array.isArray(data?.items)) items = data.items;
      else if (Array.isArray(data?.recommendations)) items = data.recommendations;
      else if (Array.isArray(data)) items = data;
      setRecommendations((prev) => ({ ...prev, [activeTab]: items }));
    } catch (err) {
      console.error("Failed to refresh recommendations:", err);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Layout>
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-serif font-bold mb-2">Recommendations</h1>
            <p className="text-muted-foreground">
              Discover your next favorite book with personalized recommendations
            </p>
          </div>
          <Button
            variant="outline"
            onClick={refreshRecommendations}
            disabled={isLoading}
            className="flex items-center space-x-2"
          >
            <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
            <span>Refresh</span>
          </Button>
        </div>

        {/* Recommendation Engine Info */}
        <Card className="mb-8 bg-gradient-to-r from-primary/5 to-accent/5 border-primary/20">
          <CardContent className="p-6">
            <div className="flex items-center space-x-3 mb-3">
              <div className="p-2 rounded-lg bg-gradient-primary">
                <Sparkles className="h-5 w-5 text-white" />
              </div>
              <h3 className="text-lg font-semibold">AI-Powered Recommendations</h3>
            </div>
            <p className="text-muted-foreground">
              Our recommendation engine analyzes your reading history, ratings,
              and preferences to suggest books you'll love. The more you read
              and rate, the better our recommendations become.
            </p>
          </CardContent>
        </Card>

        {/* Recommendation Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="for-you" className="flex items-center space-x-2">
              {getTabIcon("for-you")}
              <span>For You</span>
            </TabsTrigger>
            <TabsTrigger value="trending" className="flex items-center space-x-2">
              {getTabIcon("trending")}
              <span>Trending</span>
            </TabsTrigger>
            <TabsTrigger value="community-picks" className="flex items-center space-x-2">
              {getTabIcon("community-picks")}
              <span>Community Picks</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="for-you" className="mt-8">
            <div className="mb-6">
              <h2 className="text-xl font-semibold mb-2">Personalized for You</h2>
              <p className="text-muted-foreground">Based on your reading history and preferences</p>
            </div>

            {renderRecommendations("for-you")}
          </TabsContent>

          <TabsContent value="trending" className="mt-8">
            <div className="mb-6">
              <h2 className="text-xl font-semibold mb-2">Trending Now</h2>
              <p className="text-muted-foreground">Most popular books in the community this week</p>
            </div>

            {renderRecommendations("trending")}
          </TabsContent>

          <TabsContent value="community-picks" className="mt-8">
            <div className="mb-6">
              <h2 className="text-xl font-semibold mb-2">Community Favorites</h2>
              <p className="text-muted-foreground">Books loved by our reading community</p>
            </div>

            {renderRecommendations("community-picks")}
          </TabsContent>
        </Tabs>

        {/* Improve Recommendations CTA */}
        <Card className="mt-12 text-center">
          <CardContent className="p-8">
            <Sparkles className="h-12 w-12 text-primary mx-auto mb-4" />
            <h3 className="text-xl font-semibold mb-2">Want Better Recommendations?</h3>
            <p className="text-muted-foreground mb-6 max-w-md mx-auto">
              Rate more books, add titles to your library, and engage with the
              community to get more personalized suggestions.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button asChild>
                <a href="/discover">Discover Books to Rate</a>
              </Button>
              <Button variant="outline" asChild>
                <a href="/library">Manage Your Library</a>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
};

export default Recommendations;
