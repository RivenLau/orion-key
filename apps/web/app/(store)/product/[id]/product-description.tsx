"use client"

import ReactMarkdown from "react-markdown"
import { useLocale } from "@/lib/context"
import type { ProductDetail } from "@/types"

export function ProductDescription({ product }: { product: ProductDetail }) {
  const { t } = useLocale()

  return (
    <div className="mt-12">
      <div className="mb-6 flex items-center gap-2 border-b border-border pb-3">
        <svg className="h-5 w-5 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
        <h2 className="text-lg font-bold text-foreground">
          {t("product.description")}
        </h2>
      </div>

      {product.detail_md ? (
        <div className="prose prose-sm max-w-none text-muted-foreground dark:prose-invert">
          <ReactMarkdown>{product.detail_md}</ReactMarkdown>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">{product.description}</p>
      )}
    </div>
  )
}
