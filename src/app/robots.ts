import type { MetadataRoute } from "next";

// Plataforma privada: cero indexación.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", disallow: "/" },
  };
}
