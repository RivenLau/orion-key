"use client"

import { useMemo } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Trash2, Minus, Plus, ShoppingCart, ArrowRight, Package } from "lucide-react"
import { toast } from "sonner"
import { useLocale, useCart } from "@/lib/context"
import { cn } from "@/lib/utils"

export default function CartPage() {
  const { t } = useLocale()
  const router = useRouter()
  const { items, totalAmount, isLoading, updateItem, removeItem } = useCart()

  const totalQty = useMemo(() => items.reduce((s, i) => s + i.quantity, 0), [items])

  const handleUpdateQuantity = async (itemId: string, qty: number) => {
    try {
      await updateItem(itemId, qty)
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : t("common.error")
      toast.error(message)
    }
  }

  const handleRemoveItem = async (itemId: string) => {
    try {
      await removeItem(itemId)
      toast.success(t("cart.remove"))
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : t("common.error")
      toast.error(message)
    }
  }

  if (isLoading) {
    return (
      <div className="flex flex-col gap-6 pb-24">
        <h1 className="text-xl font-bold text-foreground">{t("cart.title")}</h1>
        <div className="flex items-center justify-center py-24">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        </div>
      </div>
    )
  }

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-24">
        <ShoppingCart className="mb-4 h-16 w-16 text-muted-foreground/20" />
        <p className="mb-4 text-lg font-medium text-muted-foreground">
          {t("cart.empty")}
        </p>
        <Link
          href="/"
          className="inline-flex h-10 items-center rounded-lg bg-primary px-5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
        >
          {t("cart.goShopping")}
        </Link>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6 pb-24">
      <h1 className="text-xl font-bold text-foreground">{t("cart.title")}</h1>

      {/* Items */}
      <div className="flex flex-col gap-3">
        {items.map((item) => (
          <div
            key={item.id}
            className="flex items-center gap-3 rounded-lg border border-border bg-background p-3 transition-colors hover:border-muted-foreground/20 hover:shadow-sm sm:gap-4 sm:p-4"
          >
            {/* Product Image */}
            <div className="h-16 w-16 shrink-0 overflow-hidden rounded-md bg-muted sm:h-20 sm:w-20">
              {item.cover_url ? (
                <img
                  src={item.cover_url || "/placeholder.svg"}
                  alt={item.product_title}
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center">
                  <Package className="h-6 w-6 text-muted-foreground/30" />
                </div>
              )}
            </div>

            {/* Info */}
            <div className="flex min-w-0 flex-1 flex-col gap-1">
              <Link
                href={`/product/${item.product_id}`}
                className="truncate text-sm font-medium text-card-foreground hover:text-primary transition-colors"
              >
                {item.product_title}
              </Link>
              {item.spec_name && (
                <span className="text-xs text-muted-foreground">{item.spec_name}</span>
              )}
              <div className="flex items-center gap-3">
                <span className="text-sm font-semibold text-foreground">
                  {"\u00A5"}{item.unit_price.toFixed(2)}
                </span>

                {/* Quantity Control */}
                <div className="inline-flex items-center rounded border border-border">
                  <button
                    onClick={() => handleUpdateQuantity(item.id, Math.max(1, item.quantity - 1))}
                    className="inline-flex h-7 w-7 items-center justify-center text-muted-foreground hover:bg-accent"
                    disabled={item.quantity <= 1}
                  >
                    <Minus className="h-3 w-3" />
                  </button>
                  <span className="inline-flex h-7 w-8 items-center justify-center border-x border-border bg-background text-xs text-foreground">
                    {item.quantity}
                  </span>
                  <button
                    onClick={() => handleUpdateQuantity(item.id, item.quantity + 1)}
                    className="inline-flex h-7 w-7 items-center justify-center text-muted-foreground hover:bg-accent disabled:pointer-events-none disabled:opacity-50"
                    disabled={item.stock_available != null && item.quantity >= item.stock_available}
                  >
                    <Plus className="h-3 w-3" />
                  </button>
                </div>
                {item.stock_available != null && item.quantity > item.stock_available && (
                  <p className="text-xs text-destructive">{t("product.stockInsufficient")}</p>
                )}
              </div>
            </div>

            {/* Subtotal & Remove */}
            <div className="flex flex-col items-end gap-2">
              <span className="text-sm font-bold text-foreground">
                {"\u00A5"}{item.subtotal.toFixed(2)}
              </span>
              <button
                onClick={() => handleRemoveItem(item.id)}
                className="inline-flex h-7 w-7 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                aria-label={t("cart.remove")}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Checkout Bar - fixed bottom */}
      <div className="fixed bottom-0 left-0 right-0 z-50 border-t border-border bg-background/95 backdrop-blur-sm shadow-lg">
        <div className="container mx-auto flex items-center justify-between p-4">
          <div className="text-sm text-muted-foreground">
            {t("cart.selected")} <span className="font-semibold text-foreground">{totalQty}</span>{" "}
            {t("cart.items")}
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right">
              <span className="text-sm text-muted-foreground">{t("cart.total")}:</span>
              <span className="ml-2 text-xl font-bold text-foreground">
                {"\u00A5"}{totalAmount.toFixed(2)}
              </span>
            </div>
            <button
              onClick={() => {
                if (items.length === 0) return
                router.push("/checkout")
              }}
              disabled={items.length === 0}
              className="inline-flex h-10 items-center gap-2 rounded-lg bg-primary px-5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:pointer-events-none disabled:opacity-50"
            >
              {t("cart.checkout")}
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
