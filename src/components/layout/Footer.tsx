import { Link } from 'react-router-dom';
import { Book, Github, Twitter, Mail } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';

const Footer = () => {
  const { isAuthenticated } = useAuth();

  // Helper to decide link target
  const authLink = (path: string) => (isAuthenticated ? path : '/login');

  return (
    <footer className="bg-muted/30 border-t">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          {/* Logo and Description */}
          <div className="col-span-1 md:col-span-2">
            <div className="flex items-center space-x-2 mb-4">
              <div className="p-2 rounded-lg bg-gradient-primary">
                <Book className="h-6 w-6 text-white" />
              </div>
              <span className="text-xl font-serif font-semibold">Bookshelf</span>
            </div>
            <p className="text-muted-foreground mb-4 max-w-md">
              Your digital library platform. Discover, upload, and manage your book collection. 
              Get personalized recommendations and connect with fellow readers.
            </p>
            <div className="flex space-x-4">
              <Link to="#" className="text-muted-foreground hover:text-primary transition-colors">
                <Github className="h-5 w-5" />
              </Link>
              <Link to="#" className="text-muted-foreground hover:text-primary transition-colors">
                <Twitter className="h-5 w-5" />
              </Link>
              <Link to="#" className="text-muted-foreground hover:text-primary transition-colors">
                <Mail className="h-5 w-5" />
              </Link>
            </div>
          </div>

          {/* Quick Links */}
          <div>
            <h3 className="font-semibold mb-4">Quick Links</h3>
            <ul className="space-y-2">
              <li>
                <Link to="/discover" className="text-muted-foreground hover:text-primary transition-colors">
                  Discover Books
                </Link>
              </li>
              <li>
                <Link to={authLink('/upload')} className="text-muted-foreground hover:text-primary transition-colors">
                  Upload Book
                </Link>
              </li>
              <li>
                <Link to={authLink('/library')} className="text-muted-foreground hover:text-primary transition-colors">
                  My Library
                </Link>
              </li>
              <li>
                <Link to={authLink('/recommendations')} className="text-muted-foreground hover:text-primary transition-colors">
                  Recommendations
                </Link>
              </li>
            </ul>
          </div>

          {/* Support */}
          <div>
            <h3 className="font-semibold mb-4">Support</h3>
            <ul className="space-y-2">
              <li>
                <Link to="#" className="text-muted-foreground hover:text-primary transition-colors">
                  Help Center
                </Link>
              </li>
              <li>
                <Link to="#" className="text-muted-foreground hover:text-primary transition-colors">
                  Contact Us
                </Link>
              </li>
              <li>
                <Link to="#" className="text-muted-foreground hover:text-primary transition-colors">
                  Privacy Policy
                </Link>
              </li>
              <li>
                <Link to="#" className="text-muted-foreground hover:text-primary transition-colors">
                  Terms of Service
                </Link>
              </li>
            </ul>
          </div>
        </div>

        <div className="border-t mt-8 pt-8 text-center text-muted-foreground">
          <p>&copy; 2025 Bookshelf. All rights reserved.</p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
