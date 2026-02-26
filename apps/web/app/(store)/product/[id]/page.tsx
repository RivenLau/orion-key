import Image from "next/image"
import { notFound } from "next/navigation"
import { Package } from "lucide-react"
import { getProductDetail, getPaymentChannels } from "@/services/api-server"
import { ProductActions } from "./product-actions"
import { ProductBreadcrumb } from "./product-breadcrumb"
import { ProductDescription } from "./product-description"
import { ScrollToTop } from "./scroll-to-top"
import type { Metadata } from "next"
import type { PaymentChannelItem } from "@/types"

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params
  try {
    const product = await getProductDetail(id)
    return {
      title: product.title,
      description: product.description || product.title,
      alternates: { canonical: `/product/${id}` },
      openGraph: {
        title: product.title,
        description: product.description || product.title,
        url: `/product/${id}`,
        type: "website",
        ...(product.cover_url ? { images: [{ url: product.cover_url }] } : {}),
      },
      twitter: {
        card: "summary_large_image",
        title: product.title,
        description: product.description || product.title,
        ...(product.cover_url ? { images: [product.cover_url] } : {}),
      },
    }
  } catch {
    return { title: "Not Found" }
  }
}

export default async function ProductDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  const [product, channels] = await Promise.all([
    getProductDetail(id).catch(() => null),
    getPaymentChannels().catch(() => [] as PaymentChannelItem[]),
  ])

  if (!product) notFound()

  const inStock = (product.specs?.[0]?.stock_available ?? product.stock_available ?? 0) > 0
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000"

  const breadcrumbLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "首页", item: baseUrl },
      ...(product.category_name
        ? [{ "@type": "ListItem", position: 2, name: product.category_name }]
        : []),
      { "@type": "ListItem", position: product.category_name ? 3 : 2, name: product.title },
    ],
  }

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.title,
    description: product.description || product.title,
    ...(product.cover_url ? { image: product.cover_url } : {}),
    offers: {
      "@type": "Offer",
      price: product.base_price,
      priceCurrency: product.currency || "CNY",
      availability: inStock
        ? "https://schema.org/InStock"
        : "https://schema.org/OutOfStock",
    },
  }

  return (
    <div className="flex flex-col gap-4">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbLd) }}
      />

      {/* Breadcrumb */}
      <ProductBreadcrumb title={product.title} />

      <div className="grid gap-6 lg:grid-cols-5">
        {/* Left: Image — server rendered */}
        <div className="lg:col-span-2">
          <div className="relative aspect-square overflow-hidden rounded-lg border border-border bg-muted">
            {product.cover_url ? (
              <Image
                src={product.cover_url}
                alt={product.title}
                fill
                className="object-cover"
                sizes="(max-width: 1024px) 100vw, 40vw"
                priority
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center">
                <Package className="h-20 w-20 text-muted-foreground/20" />
              </div>
            )}
          </div>
        </div>

        {/* Right: Interactive purchase section */}
        <div className="lg:col-span-3">
          <ProductActions product={product} channels={channels} />
        </div>
      </div>

      {/* Product Description */}
      <ProductDescription product={product} />

      {/* Scroll to top */}
      <ScrollToTop />
    </div>
  )
}
