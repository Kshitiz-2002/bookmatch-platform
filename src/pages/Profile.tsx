// frontend/src/pages/Profile.tsx
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Camera, Save, Star, TrendingUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import Layout from '@/components/layout/Layout';
import api from '@/lib/api';

const Profile = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();

  const [formData, setFormData] = useState({
    name: user?.name || '',
    email: user?.email || '',
  });

  const [isLoading, setIsLoading] = useState(false);
  const [statsLoading, setStatsLoading] = useState(false);
  const [stats, setStats] = useState({
    booksRead: 0,
    currentlyReading: 0,
    avgRating: 0,
    readingStreak: 0,
  });

  useEffect(() => {
    if (!user) {
      navigate('/login');
      return;
    }

    let mounted = true;

    const computeStatsFromLibrary = (items: any[] = [], serverUser: any = {}) => {
      // defensive - items may be shape { items: [...] } or array
      const list = Array.isArray(items) ? items : (items.items ?? items ?? []);

      // booksRead = status === 'read'
      const booksRead = list.filter((i: any) => (String(i?.status ?? '')).toLowerCase() === 'read').length;

      // currentlyReading = status === 'reading' or 'in-progress'
      const currentlyReading = list.filter((i: any) => {
        const s = String(i?.status ?? '').toLowerCase();
        return s === 'reading' || s === 'in-progress';
      }).length;

      // avgRating - collect all numeric rating scores from included book.ratings arrays
      const ratingValues: number[] = [];
      list.forEach((i: any) => {
        const book = i?.book ?? {};
        const ratings = Array.isArray(book?.ratings) ? book.ratings : [];
        ratings.forEach((r: any) => {
          if (typeof r === 'number') ratingValues.push(r);
          else if (typeof r === 'object' && r !== null) {
            const score = r.score ?? r.rating ?? r.value ?? r.score_value;
            if (typeof score === 'number') ratingValues.push(score);
            else if (!isNaN(Number(r))) ratingValues.push(Number(r));
          }
        });
      });
      const avgRating = ratingValues.length
        ? ratingValues.reduce((a, b) => a + b, 0) / ratingValues.length
        : (serverUser?.avgRating ?? 0);

      // readingStreak - server may provide this
      const readingStreak = serverUser?.readingStreak ?? 0;

      return {
        booksRead,
        currentlyReading,
        avgRating: Number(avgRating.toFixed(2)),
        readingStreak,
      };
    };

    const load = async () => {
      setStatsLoading(true);
      try {
        const settled = await Promise.allSettled([api.user.getMe(), api.library.getLibrary()]);
        const meRes = settled[0];
        const libRes = settled[1];

        const serverUser =
          meRes.status === 'fulfilled'
            ? ((meRes.value as any)?.user ?? (meRes.value as any))
            : {};

        // Extract library items defensively
        let libItems: any[] = [];
        if (libRes.status === 'fulfilled') {
          const v = libRes.value as any;
          if (Array.isArray(v)) libItems = v;
          else if (Array.isArray(v?.items)) libItems = v.items;
          else if (Array.isArray(v?.items?.items)) libItems = v.items.items;
          else {
            libItems = v?.items ?? v ?? [];
            if (!Array.isArray(libItems)) libItems = [libItems];
          }
        } else {
          libItems = [];
        }

        if (!mounted) return;

        // populate form fields using server user if available
        setFormData(prev => ({
          ...prev,
          name: serverUser?.name ?? prev.name,
          email: serverUser?.email ?? prev.email,
        }));

        // compute and set stats
        const computed = computeStatsFromLibrary(libItems, serverUser);
        setStats(computed);
      } catch (err) {
        console.warn('Failed to load profile/stats', err);
      } finally {
        if (mounted) setStatsLoading(false);
      }
    };

    load();
    const interval = setInterval(load, 30_000); // poll every 30s to keep live figures

    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, [user, navigate]);

  // Update basic profile (backend supports `name` and `password` in your code)
  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const payload: any = {};
      if (formData.name && formData.name !== user?.name) payload.name = formData.name;

      if (Object.keys(payload).length === 0) {
        toast({
          title: 'No changes',
          description: 'No updatable fields were changed.',
        });
        setIsLoading(false);
        return;
      }

      const res = await api.user.updateMe(payload);
      const updatedUser = res?.user ?? res;
      setFormData(prev => ({ ...prev, name: updatedUser?.name ?? prev.name }));
      toast({
        title: 'Profile updated',
        description: 'Your profile has been successfully updated.',
      });
    } catch (error: any) {
      console.error('update profile error', error);
      toast({
        title: 'Error',
        description: error?.message ?? 'Failed to update profile. Please try again.',
        variant: 'destructive'
      });
    } finally {
      setIsLoading(false);
    }
  };

  if (!user) return null;

  return (
    <Layout>
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-serif font-bold bg-gradient-primary bg-clip-text text-transparent">
              Profile
            </h1>
            <p className="text-muted-foreground mt-2">Manage your account</p>
          </div>

          
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left column: profile card */}
          <div className="lg:col-span-1 space-y-6">
            <Card className="bg-gradient-card shadow-elegant">
              <CardContent className="p-6 text-center">
                <div className="relative inline-block mb-4">
                  <div className="w-24 h-24 rounded-full bg-primary flex items-center justify-center text-white text-2xl font-semibold">
                    {formData.name?.charAt(0)?.toUpperCase() ?? user.name?.charAt(0)?.toUpperCase()}
                  </div>
                  <Button
                    size="icon"
                    variant="secondary"
                    className="absolute -bottom-2 -right-2 rounded-full shadow-elegant"
                  >
                    <Camera className="h-4 w-4" />
                  </Button>
                </div>

                <h3 className="text-xl font-semibold mb-1">{formData.name || user.name}</h3>
                <p className="text-muted-foreground text-sm mb-4">{formData.email || user.email}</p>

                <div className="grid grid-cols-2 gap-4 text-center">
                  <div>
                    <div className="text-2xl font-bold text-primary">
                      {statsLoading ? '—' : stats.booksRead}
                    </div>
                    <div className="text-xs text-muted-foreground">Books Read</div>
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-accent">
                      {statsLoading ? '—' : stats.currentlyReading}
                    </div>
                    <div className="text-xs text-muted-foreground">Currently Reading</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Right column: profile form */}
          <div className="lg:col-span-2 space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Basic Information</CardTitle>
                <CardDescription>Update your name. Email changes are not handled here.</CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleFormSubmit} className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="name">Full Name</Label>
                      <Input
                        id="name"
                        value={formData.name}
                        onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="email">Email</Label>
                      <Input id="email" type="email" value={formData.email} disabled />
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <Button type="submit" disabled={isLoading}>
                      <Save className="h-4 w-4 mr-2" />
                      {isLoading ? 'Saving...' : 'Save Changes'}
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default Profile;
