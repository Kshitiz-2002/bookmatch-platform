import { Link } from 'react-router-dom';
import { ArrowRight, Upload, Search, Star, BookOpen, Users, TrendingUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import Layout from '@/components/layout/Layout';
import heroImage from '@/assets/hero-books.jpg';
import bookCollection from '@/assets/book-collection.jpg';

const Home = () => {
  const features = [
    {
      icon: Search,
      title: "Discover Books",
      description: "Browse through thousands of books with advanced search and filtering options."
    },
    {
      icon: Upload,
      title: "Upload & Share",
      description: "Upload your own books and share them with the community or keep them private."
    },
    {
      icon: Star,
      title: "Rate & Review",
      description: "Rate books you've read and write reviews to help others discover great content."
    },
    {
      icon: BookOpen,
      title: "Personal Library",
      description: "Organize your reading list with custom statuses and track your reading progress."
    },
    {
      icon: TrendingUp,
      title: "Recommendations",
      description: "Get personalized book recommendations based on your reading history and preferences."
    },
    {
      icon: Users,
      title: "Community",
      description: "Connect with fellow readers and discover what the community is reading."
    }
  ];

  const stats = [
    { number: "10K+", label: "Books Available" },
    { number: "5K+", label: "Active Readers" },
    { number: "25K+", label: "Reviews Written" },
    { number: "4.8", label: "Average Rating" }
  ];

  return (
    <Layout>
      {/* Hero Section */}
      <section className="relative overflow-hidden bg-gradient-to-br from-background via-background to-muted/20">
        <div className="absolute inset-0 bg-gradient-hero opacity-10"></div>
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-20 lg:py-32 relative">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div className="space-y-8 animate-fade-in">
              <div className="space-y-6">
                <h1 className="text-4xl sm:text-5xl lg:text-6xl font-serif font-bold text-foreground leading-tight">
                  Your Digital
                  <span className="bg-gradient-hero bg-clip-text text-transparent"> Library</span>
                </h1>
                <p className="text-xl text-muted-foreground max-w-lg">
                  Discover, upload, and manage your book collection. Get personalized recommendations 
                  and connect with a community of passionate readers.
                </p>
              </div>
              
              <div className="flex flex-col sm:flex-row gap-4">
                <Button size="lg" variant="default" className="rounded-full px-6 py-3 bg-gradient-to-r from-[#5b6be6] via-[#8b5cf6] to-[#f59e0b] text-white font-semibold shadow-lg hover:opacity-95 focus:outline-none focus:ring-4 focus:ring-[#8b5cf620] transition" asChild>
                  <Link to="/discover">
                    Explore Books
                    <ArrowRight className="ml-2 h-5 w-5" />
                  </Link>
                </Button>
               
              </div>

              {/* Stats */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-6 pt-8">
                {stats.map((stat, index) => (
                  <div key={index} className="text-center">
                    <div className="text-2xl font-bold text-primary">{stat.number}</div>
                    <div className="text-sm text-muted-foreground">{stat.label}</div>
                  </div>
                ))}
              </div>
            </div>

            <div className="relative animate-slide-up">
              <div className="relative">
                <img
                  src={heroImage}
                  alt="Digital Library"
                  className="w-full h-[400px] lg:h-[500px] object-cover rounded-2xl shadow-book"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent rounded-2xl"></div>
              </div>
              
              {/* Floating card */}
              <div className="absolute -bottom-6 -left-6 animate-float">
                <Card className="w-48 bg-white/95 backdrop-blur shadow-elegant">
                  <CardContent className="p-4">
                    <div className="flex items-center space-x-3">
                      <img
                        src={bookCollection}
                        alt="Books"
                        className="w-12 h-12 rounded-lg object-cover"
                      />
                      <div>
                        <div className="font-semibold text-sm">Latest Upload</div>
                        <div className="text-xs text-muted-foreground">5 minutes ago</div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20 bg-muted/20">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl lg:text-4xl font-serif font-bold mb-4">
              Everything You Need
            </h2>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              A comprehensive platform for book lovers, from discovery to community engagement.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {features.map((feature, index) => (
              <Card key={index} className="group hover:shadow-elegant transition-all duration-300 hover:scale-105 bg-gradient-card">
                <CardContent className="p-6">
                  <div className="flex items-center space-x-4 mb-4">
                    <div className="p-3 rounded-xl bg-gradient-primary group-hover:shadow-glow transition-all duration-300">
                      <feature.icon className="h-6 w-6 text-white" />
                    </div>
                    <h3 className="text-xl font-semibold">{feature.title}</h3>
                  </div>
                  <p className="text-muted-foreground leading-relaxed">
                    {feature.description}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="bg-gradient-hero rounded-3xl p-12 text-center text-white relative overflow-hidden">
            <div className="absolute inset-0 bg-pattern-bg opacity-10"></div>
            <div className="relative">
              <h2 className="text-3xl lg:text-4xl font-serif font-bold mb-4">
                Ready to Start Your Reading Journey?
              </h2>
              <p className="text-xl mb-8 max-w-2xl mx-auto opacity-90">
                Join thousands of readers who have already discovered their next favorite book.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Button size="lg" variant="secondary" asChild>
                  <Link to="/register">Get Started Free</Link>
                </Button>
                <Button size="lg" variant="outline" className="border-white text-white hover:bg-white hover:text-primary" asChild>
                  <Link to="/discover">Browse Books</Link>
                </Button>
              </div>
            </div>
          </div>
        </div>
      </section>
    </Layout>
  );
};

export default Home;