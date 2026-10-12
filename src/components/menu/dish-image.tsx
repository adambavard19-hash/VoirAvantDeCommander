import type { ImageView } from "@/lib/menu/view";

/** Photo de plat responsive (variantes WebP) avec aperçu flou pendant le chargement. */
export function DishImage({
  image,
  alt,
  sizes,
  className,
  priority,
}: {
  image: ImageView;
  alt: string;
  sizes: string;
  className?: string;
  priority?: boolean;
}) {
  return (
    <img
      src={image.src}
      srcSet={image.srcSet}
      sizes={sizes}
      alt={alt}
      width={image.width ?? undefined}
      height={image.height ?? undefined}
      loading={priority ? "eager" : "lazy"}
      fetchPriority={priority ? "high" : undefined}
      decoding="async"
      className={className}
      style={image.blur ? { backgroundImage: `url(${image.blur})`, backgroundSize: "cover", backgroundPosition: "center" } : undefined}
    />
  );
}
