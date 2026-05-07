export interface Post {
  id: string;
  title: string;
  slug: string;
  excerpt: string;
  content: string;
  meta_title: string;
  meta_description: string;
  keywords: string[] | null;
  featured_image_url: string | null;
  featured_image_alt: string | null;
  category_slug: string;
  author: string;
  status: string;
  reading_minutes: number | null;
  views: number;
  faq: Array<{ q: string; a: string }> | null;
  key_takeaways: string[] | null;
  published_at: string;
  created_at: string;
  updated_at: string;
}

export interface Category {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  color: string | null;
}
