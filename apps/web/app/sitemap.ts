import type { MetadataRoute } from "next"
import { getProducts } from "@/services/api-server"

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000"

  const staticRoutes: MetadataRoute.Sitemap = [
    { url: baseUrl, lastModified: new Date(), changeFrequency: "daily", priority: 1.0 },
    { url: `${baseUrl}/login`, changeFrequency: "monthly", priority: 0.3 },
    { url: `${baseUrl}/register`, changeFrequency: "monthly", priority: 0.3 },
    { url: `${baseUrl}/order-query`, changeFrequency: "monthly", priority: 0.3 },
  ]

  try {
    const data = await getProducts({ page: 1, page_size: 1000 })
    const productRoutes: MetadataRoute.Sitemap = data.list.map((p) => ({
      url: `${baseUrl}/product/${p.id}`,
      lastModified: p.created_at ? new Date(p.created_at) : new Date(),
      changeFrequency: "weekly" as const,
      priority: 0.8,
    }))
    return [...staticRoutes, ...productRoutes]
  } catch {
    return staticRoutes
  }
}
