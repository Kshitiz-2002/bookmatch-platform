import { useState } from 'react';
import { Upload as UploadIcon, File, X, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import Layout from '@/components/layout/Layout';
import { booksAPI } from '@/lib/api';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';

const Upload = () => {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    author: '',
    isPublic: true,
    genres: [] as string[],
  });
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [newGenre, setNewGenre] = useState('');

  const availableGenres = [
    'Fiction', 'Non-Fiction', 'Technology', 'Business', 'Science', 
    'Self-Help', 'Biography', 'History', 'Philosophy', 'Art',
    'Health', 'Travel', 'Cooking', 'Sports', 'Religion'
  ];

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
    }
  };

  const handleCoverChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setCoverFile(file);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  const addGenre = (genre: string) => {
    if (genre && !formData.genres.includes(genre)) {
      setFormData({
        ...formData,
        genres: [...formData.genres, genre],
      });
    }
    setNewGenre('');
  };

  const removeGenre = (genreToRemove: string) => {
    setFormData({
      ...formData,
      genres: formData.genres.filter(genre => genre !== genreToRemove),
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFile) return;

    setIsLoading(true);

    try {
      const uploadFormData = new FormData();
      uploadFormData.append('file', selectedFile);
      uploadFormData.append('title', formData.title);
      uploadFormData.append('description', formData.description);
      uploadFormData.append('author', formData.author);
      uploadFormData.append('isPublic', formData.isPublic.toString());
      uploadFormData.append('genres', JSON.stringify(formData.genres));

      if (coverFile) {
        uploadFormData.append('cover', coverFile);
      }

      const response = await booksAPI.uploadBook(uploadFormData);
      
      toast.success('Book uploaded successfully!');
      
      // Reset form
      setFormData({
        title: '',
        description: '',
        author: '',
        isPublic: true,
        genres: [],
      });
      setSelectedFile(null);
      setCoverFile(null);

      // Navigate to the book details or library
      navigate('/library');
    } catch (error) {
      console.error('Upload failed:', error);
      toast.error(error instanceof Error ? error.message : 'Upload failed. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <Layout>
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="max-w-2xl mx-auto">
          {/* Header */}
          <div className="mb-8 text-center">
            <h1 className="text-3xl font-serif font-bold mb-2">Upload a Book</h1>
            <p className="text-muted-foreground">
              Share your book with the community or keep it in your private library
            </p>
          </div>

          <form onSubmit={handleSubmit}>
            <div className="space-y-8">
              {/* File Upload */}
              <Card>
                <CardHeader>
                  <CardTitle>Book File</CardTitle>
                  <CardDescription>
                    Upload your book file (PDF, EPUB, MOBI supported)
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {!selectedFile ? (
                      <div className="border-2 border-dashed border-muted-foreground/25 rounded-lg p-8 text-center hover:border-muted-foreground/50 transition-colors">
                        <UploadIcon className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                        <div className="space-y-2">
                          <h3 className="text-lg font-medium">Choose a file to upload</h3>
                          <p className="text-muted-foreground">
                            Select a PDF, EPUB, or MOBI file from your computer
                          </p>
                          <div className="flex justify-center">
                            <Button variant="outline" asChild>
                              <label htmlFor="book-file" className="cursor-pointer">
                                Select File
                                <input
                                  id="book-file"
                                  type="file"
                                  accept=".pdf,.epub,.mobi"
                                  onChange={handleFileChange}
                                  className="hidden"
                                  required
                                />
                              </label>
                            </Button>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center space-x-4 p-4 bg-muted/50 rounded-lg">
                        <File className="h-8 w-8 text-primary" />
                        <div className="flex-1">
                          <p className="font-medium">{selectedFile.name}</p>
                          <p className="text-sm text-muted-foreground">
                            {formatFileSize(selectedFile.size)}
                          </p>
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => setSelectedFile(null)}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Book Information */}
              <Card>
                <CardHeader>
                  <CardTitle>Book Information</CardTitle>
                  <CardDescription>
                    Provide details about your book
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="title">Title *</Label>
                      <Input
                        id="title"
                        name="title"
                        placeholder="Enter book title"
                        value={formData.title}
                        onChange={handleInputChange}
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="author">Author *</Label>
                      <Input
                        id="author"
                        name="author"
                        placeholder="Enter author name"
                        value={formData.author}
                        onChange={handleInputChange}
                        required
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="description">Description</Label>
                    <Textarea
                      id="description"
                      name="description"
                      placeholder="Provide a brief description of the book"
                      value={formData.description}
                      onChange={handleInputChange}
                      rows={4}
                    />
                  </div>
                </CardContent>
              </Card>

              {/* Cover Image */}
              <Card>
                <CardHeader>
                  <CardTitle>Book Cover (Optional)</CardTitle>
                  <CardDescription>
                    Upload a cover image for your book
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {!coverFile ? (
                    <div className="border-2 border-dashed border-muted-foreground/25 rounded-lg p-6 text-center hover:border-muted-foreground/50 transition-colors">
                      <UploadIcon className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                      <p className="text-sm text-muted-foreground mb-2">
                        Upload a cover image (JPG, PNG)
                      </p>
                      <Button variant="outline" size="sm" asChild>
                        <label htmlFor="cover-file" className="cursor-pointer">
                          Select Cover
                          <input
                            id="cover-file"
                            type="file"
                            accept="image/*"
                            onChange={handleCoverChange}
                            className="hidden"
                          />
                        </label>
                      </Button>
                    </div>
                  ) : (
                    <div className="flex items-center space-x-4 p-4 bg-muted/50 rounded-lg">
                      <div className="w-12 h-16 bg-primary/20 rounded flex items-center justify-center">
                        <File className="h-6 w-6 text-primary" />
                      </div>
                      <div className="flex-1">
                        <p className="font-medium">{coverFile.name}</p>
                        <p className="text-sm text-muted-foreground">
                          {formatFileSize(coverFile.size)}
                        </p>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => setCoverFile(null)}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Genres */}
              <Card>
                <CardHeader>
                  <CardTitle>Genres</CardTitle>
                  <CardDescription>
                    Select or add genres for your book
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex space-x-2">
                    <Select onValueChange={addGenre}>
                      <SelectTrigger className="flex-1">
                        <SelectValue placeholder="Select a genre" />
                      </SelectTrigger>
                      <SelectContent>
                        {availableGenres.filter(genre => !formData.genres.includes(genre)).map((genre) => (
                          <SelectItem key={genre} value={genre}>
                            {genre}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="flex space-x-2">
                    <Input
                      placeholder="Add custom genre"
                      value={newGenre}
                      onChange={(e) => setNewGenre(e.target.value)}
                      onKeyPress={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          addGenre(newGenre);
                        }
                      }}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => addGenre(newGenre)}
                    >
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>

                  {formData.genres.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {formData.genres.map((genre) => (
                        <Badge key={genre} variant="secondary" className="cursor-pointer">
                          {genre}
                          <X
                            className="h-3 w-3 ml-1"
                            onClick={() => removeGenre(genre)}
                          />
                        </Badge>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Privacy Settings */}
              <Card>
                <CardHeader>
                  <CardTitle>Privacy Settings</CardTitle>
                  <CardDescription>
                    Choose who can access your book
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center space-x-2">
                    <Switch
                      id="isPublic"
                      checked={formData.isPublic}
                      onCheckedChange={(checked) =>
                        setFormData({ ...formData, isPublic: checked })
                      }
                    />
                    <Label htmlFor="isPublic">
                      Make this book public
                    </Label>
                  </div>
                  <p className="text-sm text-muted-foreground mt-2">
                    {formData.isPublic
                      ? 'Anyone can discover and download this book'
                      : 'Only you can access this book'}
                  </p>
                </CardContent>
              </Card>

              {/* Submit Button */}
              <div className="flex justify-center">
                <Button
                  type="submit"
                  size="lg"
                  disabled={!selectedFile || !formData.title || !formData.author || isLoading}
                  className="w-full sm:w-auto"
                >
                  {isLoading ? 'Uploading...' : 'Upload Book'}
                </Button>
              </div>
            </div>
          </form>
        </div>
      </div>
    </Layout>
  );
};

export default Upload;