#!/usr/bin/env bash
# Regenerates NewsSparkle brand assets and author WebP derivatives.
#
# Requirements: ImageMagick 6+ (`convert`, `identify`).
#   macOS:  brew install imagemagick
#   Debian: apt-get install -y imagemagick
#
# Usage: bash scripts/build-assets.sh   (run from the repository root)
#
# Source of truth: public/logo.png (white background, "NS" monogram + wordmark).
# Outputs are committed to the repo so builds never depend on ImageMagick.
set -euo pipefail

cd "$(dirname "$0")/.."

LOGO="public/logo.png"
[ -f "$LOGO" ] || { echo "missing $LOGO" >&2; exit 1; }

# ---------------------------------------------------------------------------
# 1. Master logo: trim the dead white space, keep a little breathing room.
#    1254x1254 -> ~940x940 at 512px wide, ~10 KB instead of 836 KB.
# ---------------------------------------------------------------------------
convert "$LOGO" -fuzz 4% -trim +repage -bordercolor white -border 20 \
  -resize 512x512 -strip -define png:compression-level=9 \
  public/logo.png

# WebP twin for browsers that prefer it.
convert public/logo.png -quality 88 -define webp:method=6 -strip public/logo.webp

# ---------------------------------------------------------------------------
# 2. Favicons / PWA icons, cropped from the "NS" monogram at the top of the
#    master artwork (wordmark underneath is illegible below ~64px).
# ---------------------------------------------------------------------------
MONO_TMP="$(mktemp -d)/monogram.png"
trap 'rm -rf "$(dirname "$MONO_TMP")"' EXIT
convert public/logo.png -gravity north -crop 100%x52%+0+0 +repage \
  -fuzz 4% -trim +repage -bordercolor white -border 12 \
  -resize 512x512 -strip "$MONO_TMP"

# Maskable icons need ~10% safe padding so Android can crop to a circle.
for size in 32 48 180 192 512; do
  pad=$(( size / 10 ))
  convert "$MONO_TMP" -resize $(( size - 2 * pad ))x$(( size - 2 * pad )) \
    -background white -gravity center -extent "${size}x${size}" -strip \
    -define png:compression-level=9 "public/icon-${size}.png"
done

cp public/icon-32.png public/favicon-32.png
cp public/icon-48.png public/favicon-48.png
cp public/icon-180.png public/apple-touch-icon.png
cp public/icon-48.png public/favicon.png   # legacy /favicon.png reference

# ---------------------------------------------------------------------------
# 3. Social card (og:image / twitter:image). White card so the navy + blue
#    wordmark reads correctly; 1200x630 is the 1.91:1 OG ratio.
# ---------------------------------------------------------------------------
convert -size 1200x630 xc:white \
  \( public/logo.png -resize 320x320 \) -gravity north -geometry +0+52 -composite \
  -stroke '#e5e7eb' -strokewidth 2 -draw 'line 120,300 1080,300' \
  -font DejaVu-Sans-Bold -pointsize 46 -fill '#0b2a5b' -gravity center \
  -annotate +0+8 'Breaking news, politics, business,' \
  -annotate +0+70 'technology, health and entertainment.' \
  -font DejaVu-Sans -pointsize 26 -fill '#2563eb' -gravity south \
  -annotate +0+58 'newssparkle.lovable.app' \
  -quality 86 -strip public/og-default.jpg

# ---------------------------------------------------------------------------
# 4. Author avatars: normalise the PNGs to the size they are actually drawn at,
#    then emit a WebP twin for each.
#
#    The avatars shipped by the original phase were 150/300/400/600 px PNGs
#    (~5.3 MB total) displayed at 32–96 px. PNG is also a poor fit for
#    photographs, so these alone pushed the deploy past 7 MB.
#
#    The originals are regenerable from src/assets/export.png via
#    crop_authors.py, so downscaling here is not destructive.
#
#    OptimizedImage only advertises <source type="image/webp"> for /authors/*
#    (see canGenerateLocalWebp) — every PNG here MUST have a .webp twin, or
#    browsers 404 on the <source> and never fall back to the <img>.
# ---------------------------------------------------------------------------
if [ -d public/authors ]; then
  png_count=0
  webp_count=0
  for png in public/authors/*.png; do
    case "$png" in
      *-sm.png) target=72 ;;   # rendered at 32 px  (imageSm)
      *-md.png) target=144 ;;  # rendered at 48–64 px (imageMd)
      *-lg.png) target=192 ;;  # rendered at 96 px (imageLg)
      *)        target=320 ;;  # fallback / unknown bylines
    esac

    current=$(identify -format '%w' "$png")
    if [ "$current" -gt "$target" ]; then
      convert "$png" -resize "${target}x${target}" -strip \
        -define png:compression-level=9 -define png:compression-filter=5 \
        "$png"
      png_count=$(( png_count + 1 ))
    fi

    webp="${png%.png}.webp"
    if [ ! -f "$webp" ] || [ "$png" -nt "$webp" ] || [ "${FORCE_ASSETS:-0}" = "1" ]; then
      convert "$png" -quality 82 -define webp:method=6 -strip "$webp"
      webp_count=$(( webp_count + 1 ))
    fi
  done
  echo "avatars resized: $png_count, webp written: $webp_count"
  echo "avatar payload: $(du -sh public/authors | cut -f1)"
fi

echo "assets rebuilt:"
ls -la public/logo.png public/logo.webp public/og-default.jpg public/favicon.png \
  public/icon-192.png public/icon-512.png | awk '{ printf "  %-8s %s\n", $5, $9 }'
