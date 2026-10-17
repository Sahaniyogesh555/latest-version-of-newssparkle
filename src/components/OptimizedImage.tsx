import type { ImgHTMLAttributes } from "react";

type OptimizedImageProps = ImgHTMLAttributes<HTMLImageElement> & {
  priority?: boolean;
  aspectRatio?: string;
  /** Layout classes belong on the <picture> when it is a flex/grid item. */
  pictureClassName?: string;
  /**
   * Force (true) or suppress (false) the `.webp` <source>.
   *
   * Defaults to "auto": WebP is advertised only for /authors/* assets, which
   * `npm run assets` guarantees a .webp twin for. When a <source> is advertised
   * the browser will NOT fall back to the <img> if the file 404s, so this must
   * never be enabled for directories without generated WebP files.
   */
  webp?: boolean;
};

const canGenerateLocalWebp = (src?: string) => {
  if (!src) return false;
  return /^\/authors\/.*\.(?:jpe?g|png)$/i.test(src);
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
  pictureClassName,
  webp,
  style,
  ...rest
}: OptimizedImageProps) {
  const source = typeof src === "string" ? src : "";
  const useWebp = webp ?? canGenerateLocalWebp(source);
  const webpSource = useWebp && canGenerateLocalWebp(source)
    ? source.replace(/\.(jpe?g|png)$/i, ".webp")
    : undefined;

  const aspectClass = aspectRatio ? `aspect-${aspectRatio.replace('/', '\\/')}` : '';
  const combinedClassName = [className, aspectClass].filter(Boolean).join(' ');

  return (
    <picture className={pictureClassName}>
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
