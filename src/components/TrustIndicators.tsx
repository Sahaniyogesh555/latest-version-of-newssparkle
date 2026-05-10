import { Badge } from "@/components/ui/badge";
import { AuthorImage } from "@/components/AuthorImage";
import { AuthorProfile } from "@/lib/authors";
import { CheckCircle, Shield, Award, Users, Clock, Eye } from "lucide-react";

interface TrustIndicatorsProps {
  showVerified?: boolean;
  showExpertise?: boolean;
  showTransparency?: boolean;
  showEngagement?: boolean;
  views?: number;
  readingTime?: number;
  authorRole?: string;
  publishedAt?: string;
  updatedAt?: string;
  compact?: boolean;
}

export function TrustIndicators({
  showVerified = true,
  showExpertise = true,
  showTransparency = true,
  showEngagement = true,
  views,
  readingTime,
  authorRole,
  publishedAt,
  updatedAt,
  compact = false
}: TrustIndicatorsProps) {
  const wasUpdated = updatedAt && updatedAt !== publishedAt;

  const badgeSize = compact ? "text-xs px-2 py-1" : "text-sm px-3 py-1.5";
  const iconSize = compact ? "w-3 h-3" : "w-4 h-4";

  return (
    <div className="flex flex-wrap items-center gap-2">
      {showVerified && (
        <Badge variant="secondary" className={`badge-verified ${badgeSize}`}>
          <CheckCircle className={`${iconSize} mr-1`} />
          {!compact && "Fact-Checked"}
          {compact && "✓"}
        </Badge>
      )}

      {showExpertise && authorRole && (
        <Badge variant="outline" className={`badge-expert ${badgeSize}`}>
          <Award className={`${iconSize} mr-1`} />
          {authorRole}
        </Badge>
      )}

      {showTransparency && wasUpdated && (
        <Badge variant="outline" className={`badge-updated ${badgeSize}`}>
          <Shield className={`${iconSize} mr-1`} />
          {!compact && "Updated"}
          {compact && "↻"}
        </Badge>
      )}

      {showEngagement && (
        <div className="flex items-center gap-3 text-xs text-byline">
          {readingTime && (
            <div className="flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {readingTime} min
            </div>
          )}
          {views !== undefined && (
            <div className="flex items-center gap-1">
              <Eye className="w-3 h-3" />
              {views.toLocaleString()}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// Specialized component for article headers
export function ArticleTrustHeader({
  author,
  publishedAt,
  updatedAt,
  views,
  readingTime,
  category
}: {
  author: { name: string; role: string; image?: string; slug?: string } | AuthorProfile;
  publishedAt: string;
  updatedAt?: string;
  views?: number;
  readingTime?: number;
  category?: string;
}) {
  const wasUpdated = updatedAt && updatedAt !== publishedAt;
  const authorData = author as AuthorProfile;

  return (
    <div className="bg-gradient-to-r from-primary/5 to-secondary/5 border border-primary/10 rounded-lg p-4 mb-6">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          {authorData.slug ? (
            <AuthorImage author={authorData} size="md" ring={false} />
          ) : (
            // Fallback for generic author object
            <img
              src={author.image || 'data:image/svg+xml,<svg/>'} 
              alt={author.name}
              className="w-12 h-12 rounded-full object-cover ring-2 ring-primary/20 bg-muted"
            />
          )}
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="font-semibold text-foreground">{author.name}</span>
              <Badge variant="outline" className="badge-expert text-xs">
                <Award className="w-3 h-3 mr-1" />
                {author.role}
              </Badge>
            </div>
            <div className="flex items-center gap-4 text-sm text-byline">
              <div className="flex items-center gap-1">
                <Clock className="w-4 h-4" />
                Published {new Date(publishedAt).toLocaleDateString('en-US', {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric'
                })}
              </div>
              {wasUpdated && (
                <div className="flex items-center gap-1 text-primary">
                  <Shield className="w-4 h-4" />
                  Updated {new Date(updatedAt!).toLocaleDateString('en-US', {
                    year: 'numeric',
                    month: 'short',
                    day: 'numeric'
                  })}
                </div>
              )}
              {readingTime && (
                <div className="flex items-center gap-1">
                  <Users className="w-4 h-4" />
                  {readingTime} min read
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="text-right">
          <TrustIndicators
            showVerified={true}
            showExpertise={false}
            showTransparency={true}
            showEngagement={true}
            views={views}
            readingTime={readingTime}
            publishedAt={publishedAt}
            updatedAt={updatedAt}
            compact={true}
          />
        </div>
      </div>

      {category && (
        <div className="mt-3 pt-3 border-t border-primary/10">
          <Badge variant="secondary" className="badge-published">
            <CheckCircle className="w-3 h-3 mr-1" />
            Published in {category}
          </Badge>
        </div>
      )}
    </div>
  );
}