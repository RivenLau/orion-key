"use client"

import { useState, useRef, useEffect } from "react"
import { useRouter } from "next/navigation"
import { ShoppingBag, Mail, CreditCard, Lock } from "lucide-react"
import { toast } from "sonner"
import { useLocale, useCart } from "@/lib/context"
import { orderApi, paymentApi, withMockFallback, getApiErrorMessage } from "@/services/api"
import { mockPaymentChannels, mockCreateOrder } from "@/lib/mock-data"
import { validateEmail, generateIdempotencyKey, getCurrencySymbol, detectPaymentDevice, isMobileDevice } from "@/lib/utils"
import { PaymentSelector } from "@/components/shared/payment-selector"
import type { PaymentChannelItem } from "@/types"

export default function CheckoutPage() {
  const { t } = useLocale()
  const router = useRouter()
  const { items, totalAmount, itemCount, refreshCart } = useCart()

  const [email, setEmail] = useState("")
  const [channels, setChannels] = useState<PaymentChannelItem[]>([])
  const [selectedPayment, setSelectedPayment] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const emailInputRef = useRef<HTMLInputElement>(null)

  // Fetch payment channels on mount
  useEffect(() => {
    let cancelled = false
    async function fetchChannels() {
      try {
        const chs = await withMockFallback(
          () => paymentApi.getChannels(),
          () => mockPaymentChannels
        )
        if (!cancelled) {
          const enabled = chs.filter(c => c.is_enabled)
          setChannels(enabled)
          if (enabled.length > 0) setSelectedPayment(enabled[0].channel_code)
        }
      } catch {
        if (!cancelled) {
          setChannels([])
        }
      }
    }
    fetchChannels()
    return () => { cancelled = true }
  }, [])

  const handleConfirmOrder = async () => {
    if (!email.trim()) {
      toast.error(t("product.emailRequired"))
      emailInputRef.current?.focus()
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

    setSubmitting(true)
    try {
      const device = detectPaymentDevice()
      const result = await withMockFallback(
        () => orderApi.createFromCart({
          email,
          payment_method: selectedPayment,
          idempotency_key: generateIdempotencyKey(),
          device,
        }),
        () => mockCreateOrder(email, selectedPayment)
      )
      await refreshCart()
      toast.success(t("checkout.processingOrder"))
      const payUrlH5 = result.payment.pay_url || ""
      const qr = result.payment.qrcode_url || result.payment.payment_url || ""
      let payUrl = `/pay/${result.payment.order_id}?method=${selectedPayment}`
      if (qr) payUrl += `&qr=${encodeURIComponent(qr)}`
      if (payUrlH5) payUrl += `&payurl=${encodeURIComponent(payUrlH5)}`
      // USDT 支付额外参数
      if (result.payment.wallet_address) {
        payUrl += `&wallet=${encodeURIComponent(result.payment.wallet_address)}`
        payUrl += `&crypto_amount=${encodeURIComponent(result.payment.crypto_amount || "")}`
        payUrl += `&chain=${encodeURIComponent(result.payment.chain || "")}`
      }
      // 移动端非 USDT：直接跳转网关支付页，避免中间经过 pay 页面的延迟
      // 导致支付宝 H5 session token 过期（"会话超时"）
      if (isMobileDevice() && payUrlH5 && !selectedPayment.startsWith("usdt_")) {
        sessionStorage.setItem(`pay_redirected_${result.payment.order_id}`, "1")
        window.location.href = payUrlH5
        return
      }
      router.push(payUrl)
    } catch (err: unknown) {
      toast.error(getApiErrorMessage(err, t))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-6 flex items-center gap-3">
        <ShoppingBag className="h-6 w-6 text-primary" />
        <h1 className="text-2xl font-bold text-foreground">{t("checkout.title")}</h1>
      </div>

      <div className="space-y-6">
        {/* Order summary */}
        <div className="rounded-lg border border-border bg-background p-6">
          <h2 className="mb-4 text-base font-semibold text-foreground">{t("checkout.summary")}</h2>
          <div className="space-y-3">
            {items.map((item) => (
              <div key={item.id} className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">
                  {item.product_title}
                  {item.spec_name ? ` (${item.spec_name})` : ""}
                  {" x"}{item.quantity}
                </span>
                <span className="font-medium text-foreground">{getCurrencySymbol(item.currency)}{item.subtotal.toFixed(2)}</span>
              </div>
            ))}
            <div className="flex items-center justify-between border-t border-border pt-3">
              <span className="text-base font-medium text-foreground">{t("checkout.totalAmount")}</span>
              <span className="text-2xl font-bold text-primary">
                {getCurrencySymbol(items[0]?.currency)}{totalAmount.toFixed(2)}
              </span>
            </div>
          </div>
        </div>

        {/* Email */}
        <div className="rounded-lg border border-border bg-background p-6">
          <div className="mb-4 flex items-center gap-2">
            <Mail className="h-5 w-5 text-primary" />
            <h2 className="text-base font-semibold text-foreground">
              {t("product.email")}
            </h2>
          </div>
          <input
            ref={emailInputRef}
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder={t("product.emailPlaceholder")}
            className="mb-2 w-full rounded-lg border border-input bg-background px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
          />
          <p className="text-xs text-muted-foreground">
            {t("product.emailFullHint")}
          </p>
        </div>

        {/* Payment method */}
        <div className="rounded-lg border border-border bg-background p-6">
          <div className="mb-4 flex items-center gap-2">
            <CreditCard className="h-5 w-5 text-primary" />
            <h2 className="text-base font-semibold text-foreground">
              {t("product.paymentMethod")}
            </h2>
          </div>
          <PaymentSelector
            channels={channels}
            selected={selectedPayment}
            onSelect={setSelectedPayment}
          />
          {selectedPayment.startsWith("usdt_") && (
            <p className="mt-2 text-xs text-muted-foreground">
              {t("payment.usdt.rateHint")}
            </p>
          )}
        </div>

        {/* Security notice */}
        <div className="flex items-start gap-3 rounded-lg border border-border bg-muted/30 p-4">
          <Lock className="h-5 w-5 shrink-0 text-muted-foreground" />
          <div className="text-xs text-muted-foreground">
            <p className="mb-1 font-medium text-foreground">{t("checkout.securePayment")}</p>
            <p>{t("checkout.securePaymentDesc")}</p>
          </div>
        </div>

        {/* Confirm button */}
        <button
          onClick={handleConfirmOrder}
          disabled={submitting || items.length === 0}
          className="scheme-glow w-full rounded-lg bg-primary py-3.5 text-base font-semibold text-primary-foreground transition-all hover:brightness-110 disabled:pointer-events-none disabled:opacity-50"
        >
          {submitting ? (
            <span className="inline-flex items-center gap-2">
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-primary-foreground border-t-transparent" />
              {t("checkout.processingOrder")}
            </span>
          ) : (
            <>{t("checkout.confirmOrder")} {getCurrencySymbol(items[0]?.currency)}{totalAmount.toFixed(2)}</>
          )}
        </button>
      </div>
    </div>
  )
}
