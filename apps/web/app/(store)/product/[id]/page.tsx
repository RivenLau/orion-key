"use client"

import { useState, useMemo, useRef, useEffect } from "react"
import { use } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import {
  ArrowLeft,
  ShoppingCart,
  Zap,
  Minus,
  Plus,
  Package,
  TrendingUp,
} from "lucide-react"
import { toast } from "sonner"
import { useLocale, useAuth, useCart } from "@/lib/context"
import { productApi, orderApi, paymentApi, withMockFallback } from "@/services/api"
import { mockProductDetail, mockPaymentChannels, mockCreateOrder } from "@/lib/mock-data"
import { cn, validateEmail, generateIdempotencyKey } from "@/lib/utils"
import { PaymentSelector } from "@/components/shared/payment-selector"
import type { ProductDetail, ProductSpec, PaymentChannelItem } from "@/types"

export default function ProductDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const { t } = useLocale()
  const { isLoggedIn } = useAuth()
  const { addItem } = useCart()
  const router = useRouter()
  const emailInputRef = useRef<HTMLInputElement>(null)

  // -- State -------------------------------------------------
  const [product, setProduct] = useState<ProductDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [channels, setChannels] = useState<PaymentChannelItem[]>([])

  const [selectedSpec, setSelectedSpec] = useState<ProductSpec | null>(null)
  const [quantity, setQuantity] = useState(1)
  const [email, setEmail] = useState("")
  const [emailError, setEmailError] = useState("")
  const [selectedPayment, setSelectedPayment] = useState("")
  const [showScrollTop, setShowScrollTop] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  // -- Fetch product + payment channels ---------------------
  useEffect(() => {
    let cancelled = false
    async function fetchData() {
      setLoading(true)
      try {
        const [prod, chs] = await Promise.all([
          withMockFallback(
            () => productApi.getDetail(id),
            () => {
              const detail = mockProductDetail(id)
              if (!detail) throw new Error("Not found")
              return detail
            }
          ),
          withMockFallback(
            () => paymentApi.getChannels(),
            () => mockPaymentChannels
          ),
        ])
        if (!cancelled) {
          setProduct(prod)
          setSelectedSpec(prod.specs?.[0] || null)
          const enabled = chs.filter(c => c.is_enabled)
          setChannels(enabled)
          if (enabled.length > 0) setSelectedPayment(enabled[0].channel_code)
        }
      } catch {
        if (!cancelled) {
          setProduct(null)
          setChannels([])
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    fetchData()
    return () => { cancelled = true }
  }, [id])

  // -- Derived -----------------------------------------------
  const currentPrice = useMemo(() => {
    if (!selectedSpec) return 0
    if (product?.wholesale_enabled && product.wholesale_rules?.length) {
      const sorted = [...product.wholesale_rules].sort(
        (a, b) => b.min_quantity - a.min_quantity
      )
      for (const rule of sorted) {
        if (quantity >= rule.min_quantity) return rule.unit_price
      }
    }
    return selectedSpec.price
  }, [selectedSpec, quantity, product])

  const totalPrice = currentPrice * quantity

  const handleEmailChange = (value: string) => {
    setEmail(value)
    if (value && !validateEmail(value)) {
      setEmailError(t("product.emailInvalid"))
    } else {
      setEmailError("")
    }
  }

  const deliveryType = "auto"

  // Scroll to top button
  useEffect(() => {
    const handleScroll = () => {
      setShowScrollTop(window.scrollY > 400)
    }
    window.addEventListener("scroll", handleScroll, { passive: true })
    return () => window.removeEventListener("scroll", handleScroll)
  }, [])

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: "smooth" })
  }

  // -- Loading state ----------------------------------------
  if (loading) {
    return (
      <div className="flex flex-col gap-6">
        <div className="h-6 w-32 animate-pulse rounded bg-muted" />
        <div className="grid gap-6 lg:grid-cols-5">
          <div className="lg:col-span-2">
            <div className="aspect-square animate-pulse rounded-lg bg-muted" />
          </div>
          <div className="lg:col-span-3 space-y-4">
            <div className="h-8 w-3/4 animate-pulse rounded bg-muted" />
            <div className="h-40 animate-pulse rounded-lg bg-muted" />
            <div className="h-60 animate-pulse rounded-lg bg-muted" />
          </div>
        </div>
      </div>
    )
  }

  // -- Not found state --------------------------------------
  if (!product) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <p className="text-muted-foreground">{t("product.notFound")}</p>
        <Link href="/" className="mt-4 text-sm text-primary underline">
          {t("common.back")}
        </Link>
      </div>
    )
  }

  // -- Handlers ---------------------------------------------
  const handleBuyNow = async () => {
    if (!email.trim()) {
      toast.error(t("product.emailRequired"))
      emailInputRef.current?.focus()
      emailInputRef.current?.scrollIntoView({ behavior: "smooth", block: "center" })
      return
    }
    if (!validateEmail(email)) {
      toast.error(t("product.emailInvalid"))
      emailInputRef.current?.focus()
      return
    }
    if (!selectedPayment) {
      toast.error(t("product.paymentMethod"))
      return
    }
    if (!selectedSpec) return

    setSubmitting(true)
    try {
      const result = await withMockFallback(
        () => orderApi.create({
          product_id: product.id,
          spec_id: selectedSpec.id,
          quantity,
          email,
          payment_method: selectedPayment,
          idempotency_key: generateIdempotencyKey(),
        }),
        () => mockCreateOrder(email, selectedPayment)
      )
      toast.success(t("checkout.processingOrder"))
      router.push(`/pay/${result.payment.order_id}?method=${selectedPayment}`)
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : t("common.error")
      toast.error(message)
    } finally {
      setSubmitting(false)
    }
  }

  const handleAddToCart = async () => {
    if (!selectedSpec) return
    try {
      await addItem({
        product_id: product.id,
        spec_id: selectedSpec.id,
        quantity,
      })
      toast.success(t("product.addToCart"))
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : t("common.error")
      toast.error(message)
    }
  }

  // -- Render ------------------------------------------------
  return (
    <div className="flex flex-col gap-4">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Link
          href="/"
          className="inline-flex items-center gap-1 transition-colors hover:text-foreground"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          {t("common.back")}
        </Link>
        <span>/</span>
        <span className="truncate max-w-[200px] sm:max-w-none">{product.title}</span>
      </div>

      <div className="grid gap-6 lg:grid-cols-5">
        {/* Left: Image */}
        <div className="lg:col-span-2">
          <div className="aspect-square overflow-hidden rounded-lg border border-border bg-muted">
            {product.cover_url ? (
              <img
                src={product.cover_url || "/placeholder.svg"}
                alt={product.title}
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center">
                <Package className="h-20 w-20 text-muted-foreground/20" />
              </div>
            )}
          </div>
        </div>

        {/* Right: Info + Purchase - Sticky */}
        <div className="lg:col-span-3">
          <div className="lg:sticky lg:top-4 flex flex-col gap-4">
            {/* Title */}
            <div>
              <h1 className="text-xl font-bold text-foreground text-balance">
                {product.title}
              </h1>
            </div>

            {/* Price + Specs + Wholesale + Stock */}
            <div className="rounded-lg border border-border p-4 space-y-4">
              {/* Price row + delivery status */}
              <div className="flex items-baseline justify-between">
                <div className="flex items-baseline gap-3">
                  <div className="flex items-baseline gap-2">
                    <span className="text-sm text-muted-foreground">{"\u00A5"}</span>
                    <span className="text-2xl font-extrabold text-primary">
                      {currentPrice.toFixed(2)}
                    </span>
                  </div>
                </div>

                {/* Delivery status indicator */}
                <div className={cn(
                  "inline-flex items-center gap-1.5 rounded-full border px-3 py-1",
                  deliveryType === "auto"
                    ? "border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-900/20"
                    : "border-yellow-200 bg-yellow-50 dark:border-yellow-800 dark:bg-yellow-900/20"
                )}>
                  <span className={cn(
                    "relative inline-flex h-2 w-2 rounded-full",
                    deliveryType === "auto" ? "bg-green-500" : "bg-yellow-500"
                  )}>
                    <span className={cn(
                      "absolute inline-flex h-full w-full animate-ping rounded-full opacity-75",
                      deliveryType === "auto" ? "bg-green-400" : "bg-yellow-400"
                    )} />
                  </span>
                  <span className={cn(
                    "text-xs font-semibold",
                    deliveryType === "auto"
                      ? "text-green-700 dark:text-green-300"
                      : "text-yellow-700 dark:text-yellow-300"
                  )}>
                    {deliveryType === "auto" ? t("product.deliveryAuto") : t("product.deliveryManual")}
                  </span>
                </div>
              </div>

              {/* Stock + Sales */}
              <div className="flex items-center gap-4 text-sm">
                <span className="flex items-center gap-1.5 text-muted-foreground">
                  <Package className="h-3.5 w-3.5" />
                  {t("product.stock")} {selectedSpec?.stock_available ?? product.stock_available}
                </span>
                {product.sales_count != null && product.sales_count > 0 && (
                  <span className="flex items-center gap-1.5 text-muted-foreground">
                    <TrendingUp className="h-3.5 w-3.5" />
                    {t("product.sold")} {product.sales_count}
                  </span>
                )}
              </div>

              {/* Wholesale tier hints */}
              {product.wholesale_enabled && product.wholesale_rules && product.wholesale_rules.length > 0 && (
                <div className="rounded-md bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 px-3 py-2">
                  <div className="flex flex-wrap gap-2 text-xs">
                    {product.wholesale_rules.map((rule, idx) => {
                      const isActive = quantity >= rule.min_quantity
                      return (
                        <span
                          key={idx}
                          className={cn(
                            "inline-flex items-center gap-1 rounded px-2 py-1 font-medium transition-colors",
                            isActive
                              ? "bg-amber-500 text-white"
                              : "bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-300"
                          )}
                        >
                          {t("product.tierHint").replace("{qty}", String(rule.min_quantity))}
                          {": "}
                          {"\u00A5"}{rule.unit_price.toFixed(2)}/{t("product.perPiece")}
                        </span>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* Spec selection */}
              {product.specs && product.specs.length > 1 && (
                <div>
                  <label className="mb-2 block text-sm font-medium text-foreground">
                    {t("product.selectSpec")}
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {product.specs.map((spec) => (
                      <button
                        key={spec.id}
                        onClick={() => {
                          setSelectedSpec(spec)
                          setQuantity(1)
                        }}
                        className={cn(
                          "rounded-md border px-3 py-1.5 text-sm font-medium transition-colors",
                          selectedSpec?.id === spec.id
                            ? "border-primary bg-primary/10 text-primary"
                            : "border-border text-foreground hover:border-primary/30"
                        )}
                        disabled={spec.stock_available === 0}
                      >
                        {spec.name}
                        {spec.stock_available === 0 && (
                          <span className="ml-1 text-xs text-muted-foreground">
                            ({t("product.outOfStock")})
                          </span>
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Action area */}
            <div className="rounded-lg border border-border p-4 space-y-4">
              {/* Quantity */}
              <div>
                <label className="mb-2 block text-sm font-medium text-foreground">
                  {t("product.quantity")}
                </label>
                <div className="inline-flex items-center rounded-md border border-border">
                  <button
                    onClick={() => setQuantity(Math.max(1, quantity - 1))}
                    className="inline-flex h-9 w-9 items-center justify-center text-muted-foreground transition-colors hover:bg-accent"
                    disabled={quantity <= 1}
                  >
                    <Minus className="h-4 w-4" />
                  </button>
                  <input
                    type="number"
                    min={1}
                    max={selectedSpec?.stock_available || 999}
                    value={quantity}
                    onChange={(e) => {
                      const v = parseInt(e.target.value) || 1
                      setQuantity(Math.min(v, selectedSpec?.stock_available || 999))
                    }}
                    className="h-9 w-16 border-x border-border bg-background text-center text-sm text-foreground [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                  />
                  <button
                    onClick={() =>
                      setQuantity(Math.min(quantity + 1, selectedSpec?.stock_available || 999))
                    }
                    className="inline-flex h-9 w-9 items-center justify-center text-muted-foreground transition-colors hover:bg-accent"
                    disabled={quantity >= (selectedSpec?.stock_available || 999)}
                  >
                    <Plus className="h-4 w-4" />
                  </button>
                </div>
              </div>

              {/* Email input */}
              <div>
                <label className="mb-1.5 block text-sm font-medium text-foreground">
                  {t("product.email")}
                </label>
                <input
                  ref={emailInputRef}
                  type="email"
                  placeholder={t("product.emailPlaceholder")}
                  value={email}
                  onChange={(e) => handleEmailChange(e.target.value)}
                  className={cn(
                    "h-10 w-full rounded-lg border bg-background px-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring",
                    emailError ? "border-destructive" : "border-input"
                  )}
                />
                <div className="mt-1.5">
                  <p className="text-xs text-muted-foreground">
                    {t("product.emailFullHint")}
                  </p>
                  {emailError && (
                    <p className="mt-1 text-xs text-destructive">{emailError}</p>
                  )}
                </div>
              </div>

              {/* Payment method */}
              <div>
                <label className="mb-2 block text-sm font-medium text-foreground">
                  {t("product.paymentMethod")}
                </label>
                <PaymentSelector
                  channels={channels}
                  selected={selectedPayment}
                  onSelect={setSelectedPayment}
                />
              </div>

              {/* Total */}
              <div className="flex items-baseline justify-between border-t border-border pt-4">
                <span className="text-sm text-muted-foreground">{t("product.totalPrice")}</span>
                <div className="flex items-baseline gap-1">
                  <span className="text-sm text-primary">{"\u00A5"}</span>
                  <span className="text-2xl font-bold text-primary">
                    {totalPrice.toFixed(2)}
                  </span>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-3">
                <button
                  onClick={handleBuyNow}
                  disabled={submitting}
                  className="scheme-glow inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-lg bg-primary text-sm font-semibold text-primary-foreground transition-all hover:brightness-110 disabled:pointer-events-none disabled:opacity-50"
                >
                  {submitting ? (
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary-foreground border-t-transparent" />
                  ) : (
                    <Zap className="h-4 w-4" />
                  )}
                  {t("product.buyNow")}
                </button>
                <button
                  onClick={handleAddToCart}
                  className="inline-flex h-11 items-center justify-center gap-2 rounded-lg border border-border bg-transparent px-5 text-sm font-medium text-foreground transition-colors hover:bg-accent"
                >
                  <ShoppingCart className="h-4 w-4" />
                  {t("product.addToCart")}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Product Description */}
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
            {product.detail_md}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">{product.description}</p>
        )}
      </div>

      {/* Scroll to top button */}
      <button
        onClick={scrollToTop}
        className={cn(
          "fixed bottom-8 right-8 z-50 flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-primary to-primary/80 text-primary-foreground shadow-lg transition-all duration-300 hover:scale-110 hover:shadow-xl active:scale-95",
          showScrollTop ? "translate-y-0 opacity-100" : "pointer-events-none translate-y-4 opacity-0"
        )}
        aria-label={t("common.backToTop")}
      >
        <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7-7v18" />
        </svg>
      </button>
    </div>
  )
}
