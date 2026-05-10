import { AuthorProfile } from "@/lib/authors";
import { OptimizedImage } from "@/components/OptimizedImage";
import { cn } from "@/lib/utils";

interface AuthorImageProps {
  author: AuthorProfile;
  size?: "sm" | "md" | "lg" | "xl"; // sm: 32px, md: 48px, lg: 64px, xl: 96px
  className?: string;
  loading?: "eager" | "lazy";
  ring?: boolean;
}

// Map size to pixel dimensions and image variant
const sizeConfig = {
  sm: { px: 32, variant: "Sm" as const },   // 32x32 - small cards/mentions
  md: { px: 48, variant: "Md" as const },   // 48x48 - standard cards/bylines
  lg: { px: 64, variant: "Md" as const },   // 64x64 - article byline/author pages
  xl: { px: 96, variant: "Lg" as const },   // 96x96 - author profile hero
};

export function AuthorImage({
  author,
  size = "md",
  className,
  loading = "lazy",
  ring = true,
}: AuthorImageProps) {
  const config = sizeConfig[size];
  
  // Select appropriate image variant (imageSm, imageMd, imageLg)
  const imageUrl = author[`image${config.variant}` as keyof AuthorProfile] ||
                   author.imageMd ||
                   author.image;

  return (
    <OptimizedImage
      src={imageUrl as string}
      alt={`${author.name} avatar`}
      width={config.px}
      height={config.px}
      loading={loading}
      className={cn(
        "rounded-full object-cover bg-muted",
        ring && "ring-1 ring-border",
        className
      )}
      style={{
        width: `${config.px}px`,
        height: `${config.px}px`,
      }}
    />
  );
}

/**
 * Quick inline author avatar - for compact displays
 * Renders just the avatar without additional elements
 */
export function AuthorAvatarSmall({ author, className }: { author: AuthorProfile; className?: string }) {
  return <AuthorImage author={author} size="sm" className={className} />;
}

/**
 * Author byline with avatar and info
 * Perfect for article bylines and card footers
 */
export function AuthorByline({
  author,
  showRole = false,
  compact = false,
}: {
  author: AuthorProfile;
  showRole?: boolean;
  compact?: boolean;
}) {
  return (
    <div className="flex items-center gap-2">
      <AuthorImage
        author={author}
        size={compact ? "sm" : "md"}
        className="flex-shrink-0"
      />
      <div className="min-w-0">
        <div className="text-sm font-medium text-foreground truncate">{author.name}</div>
        {showRole && (
          <div className="text-xs text-byline truncate">{author.role}</div>
        )}
      </div>
    </div>
  );
}
