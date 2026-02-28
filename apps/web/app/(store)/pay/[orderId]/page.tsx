"use client"

import { useState, useEffect, useCallback } from "react"
import { use } from "react"
import Link from "next/link"
import { useSearchParams, useRouter } from "next/navigation"
import {
  Clock,
  CheckCircle2,
  XCircle,
  RefreshCw,
  Copy,
  ExternalLink,
  HelpCircle,
  Loader2,
} from "lucide-react"
import { QRCodeSVG } from "qrcode.react"
import { toast } from "sonner"
import { useLocale, useCart, useSiteConfig } from "@/lib/context"
import { orderApi, withMockFallback } from "@/services/api"
import type { OrderStatus } from "@/types"
import { cn } from "@/lib/utils"
import { PaymentIcon, getPaymentLabel, getPaymentBrandColor, getPaymentScanHint } from "@/components/shared/payment-icon"

const POLL_INTERVAL = 3000 // 3 seconds
const MANUAL_REFRESH_COOLDOWN = 10 // 10 seconds

export default function PaymentPage({ params }: { params: Promise<{ orderId: string }> }) {
  const { orderId } = use(params)
  const { t } = useLocale()
  const { config } = useSiteConfig()
  const searchParams = useSearchParams()

  const router = useRouter()
  const { refreshCart } = useCart()

  const [status, setStatus] = useState<OrderStatus>("PENDING")
  const [timeLeft, setTimeLeft] = useState(-1) // -1 = 等待服务端返回真实倒计时，避免闪屏
  const [refreshCooldown, setRefreshCooldown] = useState(0)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [qrcodeUrl, setQrcodeUrl] = useState<string>("")

  const paymentMethod = searchParams.get("method") || "alipay"
  const paymentMethodName = getPaymentLabel(paymentMethod, t)
  const scanHint = getPaymentScanHint(paymentMethod, t)
  const brandColor = getPaymentBrandColor(paymentMethod)

  // 初始化：获取订单状态 + QR code + 真实倒计时
  useEffect(() => {
    const qrFromParam = searchParams.get("qr")
    if (qrFromParam) {
      setQrcodeUrl(decodeURIComponent(qrFromParam))
    }

    // 从 API 获取服务端计算的 remaining_seconds，不依赖客户端时钟
    async function fetchOrderInfo() {
      try {
        const result = await orderApi.getStatus(orderId)
        if (result.remaining_seconds !== undefined) {
          setTimeLeft(result.remaining_seconds)
        }
        if (!qrFromParam && result.payment_url) {
          setQrcodeUrl(result.payment_url)
        }
        if (result.status !== "PENDING") {
          setStatus(result.status)
        }
      } catch {
        // silent — 首次下单可能刚创建，保持默认倒计时
      }
    }
    fetchOrderInfo()
  }, [orderId, searchParams])

  // Countdown timer — 仅在服务端返回真实倒计时后才开始递减
  useEffect(() => {
    if (status !== "PENDING" || timeLeft < 0) return
    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          setStatus("EXPIRED")
          return 0
        }
        return prev - 1
      })
    }, 1000)
    return () => clearInterval(timer)
  }, [status, timeLeft < 0])

  // Auto polling for payment status
  useEffect(() => {
    if (status !== "PENDING") return
    const poll = setInterval(async () => {
      try {
        const result = await withMockFallback(
          () => orderApi.getStatus(orderId),
          () => ({ order_id: orderId, status: "PENDING" as const, expires_at: "", remaining_seconds: 0 })
        )
        // 同步服务端倒计时，防止客户端时间漂移
        if (result.remaining_seconds !== undefined) {
          setTimeLeft(result.remaining_seconds)
        }
        if (result.status !== "PENDING") {
          setStatus(result.status)
          if (result.status === "PAID" || result.status === "DELIVERED") {
            refreshCart()
          }
        }
      } catch {
        // silent — continue polling
      }
    }, POLL_INTERVAL)
    return () => clearInterval(poll)
  }, [status, orderId, refreshCart])

  // Manual refresh cooldown
  useEffect(() => {
    if (refreshCooldown <= 0) return
    const timer = setInterval(() => {
      setRefreshCooldown((prev) => Math.max(0, prev - 1))
    }, 1000)
    return () => clearInterval(timer)
  }, [refreshCooldown])

  const handleManualRefresh = useCallback(async () => {
    if (refreshCooldown > 0 || isRefreshing) return
    setIsRefreshing(true)
    try {
      const result = await withMockFallback(
        () => orderApi.getStatus(orderId),
        () => ({ order_id: orderId, status: "PENDING" as const, expires_at: "", remaining_seconds: 0 })
      )
      if (result.status !== "PENDING") {
        setStatus(result.status)
        if (result.status === "PAID" || result.status === "DELIVERED") {
          refreshCart()
        }
      }
    } catch {
      // silent
    } finally {
      setIsRefreshing(false)
      setRefreshCooldown(MANUAL_REFRESH_COOLDOWN)
      toast.info(t("payment.statusRefreshed"))
    }
  }, [refreshCooldown, isRefreshing, orderId, t])

  const copyToClipboard = useCallback((text: string) => {
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(text).then(
        () => toast.success(t("order.copied")),
        () => fallbackCopy(text)
      )
    } else {
      fallbackCopy(text)
    }
    function fallbackCopy(val: string) {
      const ta = document.createElement("textarea")
      ta.value = val
      ta.style.position = "fixed"
      ta.style.opacity = "0"
      document.body.appendChild(ta)
      ta.select()
      document.execCommand("copy")
      document.body.removeChild(ta)
      toast.success(t("order.copied"))
    }
  }, [t])

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60)
    const s = seconds % 60
    return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`
  }

  // Success state — 倒计时自动跳转订单查询页
  const [redirectCount, setRedirectCount] = useState(5)

  useEffect(() => {
    if (status !== "PAID" && status !== "DELIVERED") return
    if (redirectCount <= 0) {
      router.push(`/order/query?orderId=${orderId}`)
      return
    }
    const timer = setTimeout(() => setRedirectCount((prev) => prev - 1), 1000)
    return () => clearTimeout(timer)
  }, [status, redirectCount, orderId, router])

  if (status === "PAID" || status === "DELIVERED") {
    return (
      <div className="mx-auto flex max-w-md flex-col items-center py-16">
        <div className="mb-4 rounded-full bg-emerald-100 p-4 dark:bg-emerald-900/30">
          <CheckCircle2 className="h-12 w-12 text-emerald-600 dark:text-emerald-400" />
        </div>
        <h1 className="mb-2 text-xl font-bold text-foreground">{t("payment.success")}</h1>
        <p className="mb-4 text-sm text-muted-foreground">
          {t("payment.successDesc").replace("{seconds}", String(redirectCount))}
        </p>
        <p className="mb-6 text-xs text-muted-foreground/70">{t("payment.successRedirectHint")}</p>
        <Link
          href={`/order/query?orderId=${orderId}`}
          className="inline-flex h-10 items-center rounded-lg bg-primary px-5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
        >
          {t("payment.goQuery")}
        </Link>
      </div>
    )
  }

  // Expired state
  if (status === "EXPIRED") {
    return (
      <div className="mx-auto flex max-w-md flex-col items-center py-16">
        <div className="mb-4 rounded-full bg-muted p-4">
          <XCircle className="h-12 w-12 text-muted-foreground" />
        </div>
        <h1 className="mb-2 text-xl font-bold text-foreground">{t("payment.expired")}</h1>
        <p className="mb-6 text-sm text-muted-foreground">{t("payment.expiredDesc")}</p>
        <Link
          href="/"
          className="inline-flex h-10 items-center rounded-lg bg-primary px-5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
        >
          {t("payment.reorder")}
        </Link>
      </div>
    )
  }

  // Pending state
  return (
    <div className="mx-auto flex max-w-lg flex-col items-center gap-6 py-8">
      {/* 外层卡片框 — 标题/倒计时/品牌卡/订单信息统一收纳 */}
      <div className="flex w-full flex-col items-center gap-5 rounded-xl border border-border bg-card p-6 shadow-sm">

        {/* 标题 + 倒计时 */}
        <h1 className="text-xl font-bold text-foreground">{t("payment.waiting")}</h1>
        <div className="flex items-center gap-2 text-muted-foreground">
          <Clock className="h-4 w-4" />
          <span className="text-sm">{t("payment.remaining")}</span>
          <span
            className={cn(
              "font-mono text-lg font-bold",
              timeLeft >= 0 && timeLeft < 120 ? "text-destructive" : "text-foreground"
            )}
          >
            {timeLeft < 0 ? "--:--" : formatTime(timeLeft)}
          </span>
        </div>

        {/* 品牌色背景卡片 */}
        <div
          className="flex w-72 flex-col items-center gap-4 rounded-2xl px-6 pb-8 pt-6"
          style={{ backgroundColor: brandColor || "#374151" }}
        >
          {/* 品牌标题：Logo + 支付方式名称（白色） */}
          <div className="flex items-center gap-2.5">
            <PaymentIcon method={paymentMethod} className="h-10 w-10" variant="plain" />
            <span className="text-xl font-bold text-white">
              {paymentMethodName}
            </span>
          </div>

          {/* 扫码指引（白色） */}
          <p className="text-sm font-medium text-white/90">
            {scanHint}
          </p>

          {/* QR Code 白色区域 */}
          <div className="flex h-52 w-52 items-center justify-center rounded-xl bg-white p-3">
            {qrcodeUrl ? (
              <QRCodeSVG
                value={qrcodeUrl}
                size={184}
                level="M"
                includeMargin={false}
              />
            ) : (
              <div className="flex flex-col items-center gap-2 text-muted-foreground">
                <Loader2 className="h-8 w-8 animate-spin" />
                <span className="text-xs">{t("common.loading")}</span>
              </div>
            )}
          </div>
        </div>

        {/* 检测状态 */}
        <p className="animate-pulse text-sm text-primary">
          {t("payment.detecting")}
        </p>

        {/* 订单号 */}
        <div className="flex w-full items-center justify-between border-t border-border pt-4 text-sm">
          <span className="text-muted-foreground">{t("payment.orderNo")}</span>
          <span className="flex items-center gap-1 font-mono text-xs text-foreground">
            <span
              className="cursor-pointer underline-offset-4 transition-all hover:underline hover:text-primary"
              title={orderId}
              onClick={() => copyToClipboard(orderId)}
            >
              {orderId.length > 20 ? `${orderId.slice(0, 8)}...${orderId.slice(-8)}` : orderId}
            </span>
            <button
              type="button"
              onClick={() => copyToClipboard(orderId)}
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              <Copy className="h-3.5 w-3.5" />
            </button>
          </span>
        </div>
      </div>

      {/* Manual Refresh */}
      <button
        onClick={handleManualRefresh}
        disabled={refreshCooldown > 0 || isRefreshing}
        className="inline-flex h-10 items-center gap-2 rounded-lg border border-border px-5 text-sm font-medium text-foreground transition-colors hover:bg-accent disabled:pointer-events-none disabled:opacity-50"
      >
        <RefreshCw className={cn("h-4 w-4", isRefreshing && "animate-spin")} />
        {isRefreshing
          ? t("payment.refreshing")
          : refreshCooldown > 0
            ? `${refreshCooldown}${t("payment.refreshLimit")}`
            : t("payment.refresh")}
      </button>

      {/* Help Links */}
      <div className="flex flex-col items-center gap-2 pt-2">
        <div className="flex items-center gap-1 text-xs text-muted-foreground">
          <HelpCircle className="h-3 w-3" />
          <span>{t("payment.needHelp")}</span>
        </div>
        <div className="flex items-center gap-4 text-xs">
          <Link
            href="/order/query"
            className="text-muted-foreground underline-offset-4 transition-colors hover:text-foreground hover:underline"
          >
            {t("payment.paidButNotDelivered")}
          </Link>
          {config?.contact_telegram && (
            <a
              href={`https://t.me/${config.contact_telegram.replace(/^@/, "")}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 text-muted-foreground underline-offset-4 transition-colors hover:text-foreground hover:underline"
            >
              {t("payment.contactSupport")}
              <ExternalLink className="h-3 w-3" />
            </a>
          )}
        </div>
      </div>
    </div>
  )
}
