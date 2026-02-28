"use client"

import { useState, useMemo } from "react"
import {
  Search,
  Zap,
  SquareCheckBig,
  ClipboardList,
  ShieldCheck,
} from "lucide-react"
import { useLocale, useSearch } from "@/lib/context"
import { ProductCard } from "@/components/store/product-card"
import { cn } from "@/lib/utils"
import type { ProductCard as ProductCardType, Category } from "@/types"

interface HomeContentProps {
  products: ProductCardType[]
  categories: Category[]
  siteSlogan: string
  siteDescription: string
}

export function HomeContent({ products, categories, siteSlogan, siteDescription }: HomeContentProps) {
  const { t } = useLocale()
  const { searchQuery, sortBy, inStockOnly, priceMin, priceMax } = useSearch()

  const [selectedCategory, setSelectedCategory] = useState<string | null>(null)

  const trustBadges = [
    { icon: SquareCheckBig, label: t("home.trustAuto"), color: "text-emerald-600 dark:text-emerald-400", bg: "bg-emerald-100 dark:bg-emerald-900/40" },
    { icon: Zap, label: t("home.trustInstant"), color: "text-amber-600 dark:text-amber-400", bg: "bg-amber-100 dark:bg-amber-900/40" },
    { icon: ClipboardList, label: t("home.trustTrack"), color: "text-blue-600 dark:text-blue-400", bg: "bg-blue-100 dark:bg-blue-900/40" },
    { icon: ShieldCheck, label: t("home.trustSecure"), color: "text-teal-600 dark:text-teal-400", bg: "bg-teal-100 dark:bg-teal-900/40" },
  ]

  const filteredProducts = useMemo(() => {
    let result = [...products]

    if (selectedCategory) {
      result = result.filter((p) => p.category_id === selectedCategory)
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      result = result.filter((p) => p.title.toLowerCase().includes(q))
    }
    if (inStockOnly) {
      result = result.filter((p) => p.stock_available > 0)
    }

    const min = Number.parseFloat(priceMin)
    const max = Number.parseFloat(priceMax)
    if (!Number.isNaN(min)) result = result.filter((p) => p.base_price >= min)
    if (!Number.isNaN(max)) result = result.filter((p) => p.base_price <= max)

    switch (sortBy) {
      case "hot":
        result.sort((a, b) => ((b.sales_count ?? 0) + (b.initial_sales ?? 0)) - ((a.sales_count ?? 0) + (a.initial_sales ?? 0)))
        break
      case "price_low":
        result.sort((a, b) => a.base_price - b.base_price)
        break
      case "price_high":
        result.sort((a, b) => b.base_price - a.base_price)
        break
      case "new":
        result.sort(
          (a, b) =>
            new Date(b.created_at ?? 0).getTime() - new Date(a.created_at ?? 0).getTime()
        )
        break
    }

    return result
  }, [products, selectedCategory, searchQuery, sortBy, inStockOnly, priceMin, priceMax])

  return (
    <div className="mx-auto w-full max-w-7xl 2xl:max-w-[1600px] flex flex-col gap-6">
      {/* Hero */}
      <section className="relative overflow-hidden rounded-xl border border-border/60 bg-card px-5 py-5 sm:px-8 sm:py-6">
        {/* Subtle radial glow behind text */}
        <div className="scheme-blob pointer-events-none absolute -left-10 -top-10 h-48 w-64 rounded-full blur-3xl" />
        <div className="scheme-blob pointer-events-none absolute -right-16 bottom-0 h-32 w-48 rounded-full blur-3xl opacity-60" />
        <h1 className="relative text-balance text-2xl font-extrabold tracking-tight sm:text-3xl">
          <span className="scheme-gradient-text">
            {siteSlogan}
          </span>
        </h1>
        <p className="relative mt-3 text-sm text-muted-foreground">
          {siteDescription}
        </p>
      </section>

      {/* Controls */}
      <div className="flex flex-col gap-5">
        {/* Trust badges */}
        <div className="flex items-center justify-center gap-5 py-3 sm:gap-7">
          {trustBadges.map((badge, i) => (
            <div key={badge.label} className="flex items-center gap-1.5">
              <div
                className={cn(
                  "flex h-6 w-6 items-center justify-center rounded-md",
                  badge.bg
                )}
              >
                <badge.icon className={cn("h-3.5 w-3.5", badge.color)} />
              </div>
              <span className="text-xs font-semibold text-foreground sm:text-sm">
                {badge.label}
              </span>
              {i < trustBadges.length - 1 && (
                <span className="ml-2 hidden text-border sm:inline">|</span>
              )}
            </div>
          ))}
        </div>

        {/* Category tabs */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setSelectedCategory(null)}
            className={cn(
              "rounded-lg px-3.5 py-1.5 text-sm font-semibold transition-all duration-200",
              selectedCategory === null
                ? "bg-primary text-primary-foreground shadow-sm"
                : "bg-muted text-muted-foreground hover:bg-accent hover:text-accent-foreground"
            )}
          >
            {t("home.allCategories")}
          </button>
          {categories.map((cat) => (
            <button
              key={cat.id}
              onClick={() =>
                setSelectedCategory(cat.id === selectedCategory ? null : cat.id)
              }
              className={cn(
                "rounded-lg px-3.5 py-1.5 text-sm font-semibold transition-all duration-200",
                selectedCategory === cat.id
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "bg-muted text-muted-foreground hover:bg-accent hover:text-accent-foreground"
              )}
            >
              {cat.name}
            </button>
          ))}
        </div>
      </div>

      {/* Product Grid */}
      {filteredProducts.length > 0 ? (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3 lg:gap-8 2xl:grid-cols-4">
          {filteredProducts.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-24 text-muted-foreground">
          <Search className="mb-3 h-10 w-10 opacity-20" />
          <p className="text-sm">{t("home.noProducts")}</p>
        </div>
      )}
    </div>
  )
}
