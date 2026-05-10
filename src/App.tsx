import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { lazy, Suspense } from "react";

// Lazy load heavy pages
const Index = lazy(() => import("./pages/Index.tsx"));
const NotFound = lazy(() => import("./pages/NotFound.tsx"));
const CategoryPage = lazy(() => import("./pages/CategoryPage.tsx"));
const PostPage = lazy(() => import("./pages/PostPage.tsx"));
const About = lazy(() => import("./pages/About.tsx"));
const Contact = lazy(() => import("./pages/Contact.tsx"));
const Privacy = lazy(() => import("./pages/Privacy.tsx"));
const Terms = lazy(() => import("./pages/Terms.tsx"));
const Disclaimer = lazy(() => import("./pages/Disclaimer.tsx"));
const FAQ = lazy(() => import("./pages/FAQ.tsx"));
const Brand = lazy(() => import("./pages/Brand.tsx"));
const EditorialPolicy = lazy(() => import("./pages/EditorialPolicy.tsx"));
const Corrections = lazy(() => import("./pages/Corrections.tsx"));
const Authors = lazy(() => import("./pages/Authors.tsx"));
const AuthorPage = lazy(() => import("./pages/AuthorPage.tsx"));
const Search = lazy(() => import("./pages/Search.tsx"));
const TagPage = lazy(() => import("./pages/TagPage.tsx"));
const Bookmarks = lazy(() => import("./pages/Bookmarks.tsx"));

const queryClient = new QueryClient();

// Loading fallback
const PageLoader = () => (
  <div className="min-h-screen flex items-center justify-center">
    <div className="animate-pulse text-primary">Loading...</div>
  </div>
);

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Suspense fallback={<PageLoader />}>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/category/:slug" element={<CategoryPage />} />
            <Route path="/post/:slug" element={<PostPage />} />
            <Route path="/about" element={<About />} />
            <Route path="/contact" element={<Contact />} />
            <Route path="/privacy" element={<Privacy />} />
            <Route path="/privacy-policy" element={<Privacy />} />
            <Route path="/terms" element={<Terms />} />
            <Route path="/disclaimer" element={<Disclaimer />} />
            <Route path="/faq" element={<FAQ />} />
            <Route path="/brand" element={<Brand />} />
            <Route path="/editorial-policy" element={<EditorialPolicy />} />
            <Route path="/corrections" element={<Corrections />} />
            <Route path="/authors" element={<Authors />} />
            <Route path="/author/:slug" element={<AuthorPage />} />
            <Route path="/search" element={<Search />} />
            <Route path="/tag/:tag" element={<TagPage />} />
            <Route path="/bookmarks" element={<Bookmarks />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </Suspense>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
