import type { ImgHTMLAttributes } from "react";

type OptimizedImageProps = ImgHTMLAttributes<HTMLImageElement> & {
  priority?: boolean;
  aspectRatio?: string;
};

const canGenerateLocalWebp = (src?: string) => {
  if (!src) return false;
  return /^\/(?:.*\.(?:jpe?g|png))$/i.test(src);
};

export function OptimizedImage({
  src,
  alt,
  className = "",
  width,
  height,
  loading = "lazy",
  decoding = "async",
  priority = false,
  aspectRatio,
  style,
  ...rest
}: OptimizedImageProps) {
  const source = typeof src === "string" ? src : src?.toString() || "";
  const webpSource = canGenerateLocalWebp(source)
    ? source.replace(/\.(jpe?g|png)$/i, ".webp")
    : undefined;

  const aspectClass = aspectRatio ? `aspect-${aspectRatio.replace('/', '\\/')}` : '';
  const combinedClassName = [className, aspectClass].filter(Boolean).join(' ');

  return (
    <picture>
      {webpSource && <source type="image/webp" srcSet={webpSource} />}
      <img
        src={source}
        alt={alt ?? ""}
        width={width}
        height={height}
        loading={priority ? "eager" : loading}
        decoding={decoding}
        fetchPriority={priority ? "high" : "auto"}
        className={combinedClassName}
        style={{
          ...style,
          ...(aspectRatio && !className?.includes('aspect-') ? { aspectRatio } : {}),
        }}
        {...rest}
      />
    </picture>
  );
}
