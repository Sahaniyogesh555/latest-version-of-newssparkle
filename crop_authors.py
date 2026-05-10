#!/usr/bin/env python3
"""
Automatically crop and process author avatars from a group image.
Maps 6 people from a 3x2 grid to individual author profiles.
"""

from PIL import Image, ImageDraw, ImageFilter
import numpy as np
from pathlib import Path

# Configuration
INPUT_IMAGE = "src/assets/export.png"
OUTPUT_DIR = Path("public/authors")
OUTPUT_DIR.mkdir(exist_ok=True)

# Avatar circular size (pixels)
AVATAR_SIZE = 600

# Author mapping: (row, col) -> (slug, name)
AUTHOR_MAP = {
    (0, 0): ("editorial-desk", "NewsSparkle Editorial Desk"),
    (0, 1): ("politics-desk", "Politics & Policy Desk"),
    (0, 2): ("business-desk", "Business & Markets Desk"),
    (1, 0): ("technology-desk", "Technology & AI Desk"),
    (1, 1): ("health-desk", "Health & Lifestyle Desk"),
    (1, 2): ("entertainment-desk", "Entertainment & Culture Desk"),
}

def detect_dominant_color_region(image_array):
    """Detect the dominant colored region (person) to center crop."""
    # Convert to HSV to better detect skin tones and clothing
    hsv = np.array(Image.fromarray(image_array).convert('HSV'))
    
    # Find vertical center of content (where most color variation is)
    h, w = image_array.shape[:2]
    
    # Use center region bias - most people are centered in their cell
    center_h, center_w = h // 2, w // 2
    
    return center_h, center_w

def crop_and_process_author(image_pil, cell_bbox, position, author_info):
    """
    Crop and process a single author image from grid cell.
    
    Args:
        image_pil: PIL Image of the group
        cell_bbox: (left, top, right, bottom) tuple for the cell
        position: (row, col) in grid
        author_info: (slug, name) tuple
    """
    slug, name = author_info
    print(f"Processing {name}...")
    
    # Crop the grid cell
    cell_image = image_pil.crop(cell_bbox)
    w, h = cell_image.size
    
    # Create intelligent professional crop
    # Use center-weighted square crop with generous framing
    size = min(w, h)
    
    # Determine crop boundaries with center bias
    left = max(0, (w - size) // 2 - int(size * 0.05))
    top = max(0, (h - size) // 2 - int(size * 0.1))
    
    # Ensure we stay within bounds
    if left + size > w:
        left = w - size
    if top + size > h:
        top = h - size
    
    # Apply slight adjustment to put person in upper-center area (professional framing)
    top = max(0, int(h * 0.05))  # Start from top 5%
    
    cropped = cell_image.crop((left, top, left + size, top + size))
    
    # Resize to target avatar size
    cropped = cropped.resize((AVATAR_SIZE, AVATAR_SIZE), Image.Resampling.LANCZOS)
    
    # Create circular avatar with soft shadow
    avatar = create_circular_avatar(cropped)
    
    # Save avatar
    output_path = OUTPUT_DIR / f"{slug}.png"
    avatar.save(output_path, "PNG", quality=95)
    print(f"✓ Saved {slug} -> {output_path}")
    
    # Also save the smaller versions for different use cases
    save_responsive_variants(cropped, slug)

def create_circular_avatar(image_pil):
    """Create a circular avatar with soft shadow and border."""
    size = image_pil.size[0]
    
    # Increase size for shadow effect
    shadow_size = int(size * 1.15)
    
    # Create base image with transparency
    base = Image.new("RGBA", (shadow_size, shadow_size), (0, 0, 0, 0))
    
    # Add soft shadow (subtle gradient)
    shadow_layer = Image.new("RGBA", (shadow_size, shadow_size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(shadow_layer)
    
    # Draw shadow circle
    shadow_color = (0, 0, 0, 25)  # Very subtle
    shadow_offset = shadow_size - size
    draw.ellipse(
        [shadow_offset//2 + 2, shadow_offset//2 + 2, shadow_offset//2 + size + 2, shadow_offset//2 + size + 2],
        fill=shadow_color
    )
    
    # Blur shadow slightly for softness
    shadow_layer = shadow_layer.filter(ImageFilter.BLUR)
    base.paste(shadow_layer, (0, 0), shadow_layer)
    
    # Create circular mask for the main image
    mask = Image.new("L", (size, size), 0)
    mask_draw = ImageDraw.Draw(mask)
    mask_draw.ellipse([0, 0, size, size], fill=255)
    
    # Convert image to RGBA if needed
    if image_pil.mode != "RGBA":
        image_pil = image_pil.convert("RGBA")
    
    # Paste circular image onto base
    offset = (shadow_size - size) // 2
    base.paste(image_pil, (offset, offset), mask)
    
    # Add subtle border
    draw = ImageDraw.Draw(base)
    border_pos = [offset - 1, offset - 1, offset + size + 1, offset + size + 1]
    draw.ellipse(border_pos, outline=(200, 200, 200, 100), width=2)
    
    return base

def save_responsive_variants(cropped, slug):
    """Save responsive size variants for different use cases."""
    sizes = {
        "md": 300,   # Medium - 300x300
        "sm": 150,   # Small - 150x150
        "lg": 400,   # Large - 400x400
    }
    
    for variant, size in sizes.items():
        resized = cropped.resize((size, size), Image.Resampling.LANCZOS)
        avatar = create_circular_avatar(resized)
        var_path = OUTPUT_DIR / f"{slug}-{variant}.png"
        avatar.save(var_path, "PNG", quality=95)

def main():
    """Main processing function."""
    print("Loading group image...")
    img = Image.open(INPUT_IMAGE)
    width, height = img.size
    
    print(f"Image size: {width}x{height}")
    
    # Grid: 3 columns x 2 rows
    cols, rows = 3, 2
    cell_width = width // cols
    cell_height = height // rows
    
    print(f"Grid: {cols}x{rows}, Cell size: {cell_width}x{cell_height}\n")
    
    # Process each author
    for row in range(rows):
        for col in range(cols):
            if (row, col) not in AUTHOR_MAP:
                continue
            
            # Calculate cell boundaries
            left = col * cell_width
            top = row * cell_height
            right = (col + 1) * cell_width if col < cols - 1 else width
            bottom = (row + 1) * cell_height if row < rows - 1 else height
            
            bbox = (left, top, right, bottom)
            author_info = AUTHOR_MAP[(row, col)]
            
            crop_and_process_author(img, bbox, (row, col), author_info)
    
    print(f"\n✓ All authors processed! Images saved to {OUTPUT_DIR}/")
    print(f"Total files created: {len(list(OUTPUT_DIR.glob('*.png')))}")

if __name__ == "__main__":
    main()
