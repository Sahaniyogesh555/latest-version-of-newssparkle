import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { AuthorImage } from "@/components/AuthorImage";
import { OptimizedImage } from "@/components/OptimizedImage";
import { AUTHORS } from "@/lib/authors";

const avatarSizes = [
  { size: "sm", pixels: 32, variant: "sm" },
  { size: "md", pixels: 48, variant: "md" },
  { size: "lg", pixels: 64, variant: "md" },
  { size: "xl", pixels: 96, variant: "lg" },
] as const;

describe("author profile pictures", () => {
  it.each(avatarSizes)("keeps the $size avatar wrapper from shrinking", ({ size, pixels, variant }) => {
    const author = AUTHORS[0];
    render(<AuthorImage author={author} size={size} />);

    const image = screen.getByRole("img", { name: `${author.name} avatar` });
    const picture = image.closest("picture");

    // The <picture>, not its child <img>, is the flex item in author cards
    // and bylines. Putting shrink-0 on just the image squeezed a 64px photo
    // to ~15px in a real browser, despite width/height attributes and styles.
    expect(picture).toHaveClass("inline-flex", "shrink-0");
    expect(image).toHaveAttribute("width", String(pixels));
    expect(image).toHaveAttribute("height", String(pixels));
    expect(image).toHaveStyle({ width: `${pixels}px`, height: `${pixels}px` });
    expect(image).toHaveClass("rounded-full", "object-cover");
    expect(image).toHaveAttribute("src", `/authors/${author.slug}-${variant}.png`);
    expect(picture?.querySelector("source")).toHaveAttribute("srcset", `/authors/${author.slug}-${variant}.webp`);
  });

  it.each(AUTHORS)("keeps the correct portrait for $name", (author) => {
    render(<AuthorImage author={author} size="xl" />);

    const image = screen.getByRole("img", { name: `${author.name} avatar` });
    expect(image).toHaveAttribute("src", `/authors/${author.slug}-lg.png`);
    expect(image.closest("picture")?.querySelector("source")).toHaveAttribute(
      "srcset",
      `/authors/${author.slug}-lg.webp`,
    );
  });

  it("retains a full-size portrait when a responsive variant is unavailable", () => {
    const author = { ...AUTHORS[0], imageSm: undefined, imageMd: undefined, imageLg: undefined };
    render(<AuthorImage author={author} size="xl" ring={false} />);

    const image = screen.getByRole("img", { name: `${author.name} avatar` });
    expect(image).toHaveAttribute("src", author.image);
    expect(image).not.toHaveClass("ring-1");
    expect(image.closest("picture")).toHaveClass("shrink-0");
  });

  it("does not apply avatar flex sizing to article pictures", () => {
    render(<OptimizedImage src="https://images.example.test/article.jpg" alt="Article photograph" />);

    const image = screen.getByRole("img", { name: "Article photograph" });
    expect(image.closest("picture")).not.toHaveClass("shrink-0");
    expect(image.closest("picture")?.querySelector("source")).toBeNull();
  });
});
