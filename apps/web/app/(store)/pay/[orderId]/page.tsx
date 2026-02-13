"use client"

import { useState, useEffect, useCallback } from "react"
import { use } from "react"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import {
  Clock,
  CheckCircle2,
  XCircle,
  RefreshCw,
  QrCode,
  Copy,
  ExternalLink,
  HelpCircle,
} from "lucide-react"
import { toast } from "sonner"
import { useLocale } from "@/lib/context"
import { orderApi, withMockFallback } from "@/services/api"
import type { OrderStatus } from "@/types"
import { cn } from "@/lib/utils"
import { PaymentIcon } from "@/components/shared/payment-icon"

const PAYMENT_TIMEOUT = 15 * 60 // 15 minutes in seconds
const POLL_INTERVAL = 3000 // 3 seconds
const MANUAL_REFRESH_COOLDOWN = 10 // 10 seconds

export default function PaymentPage({ params }: { params: Promise<{ orderId: string }> }) {
  const { orderId } = use(params)
  const { t } = useLocale()
  const searchParams = useSearchParams()

  const [status, setStatus] = useState<OrderStatus>("PENDING")
  const [timeLeft, setTimeLeft] = useState(PAYMENT_TIMEOUT)
  const [refreshCooldown, setRefreshCooldown] = useState(0)
  const [isRefreshing, setIsRefreshing] = useState(false)

  const paymentMethod = searchParams.get("method") || "alipay"
  const paymentMethodName = paymentMethod === "alipay" ? t("payment.alipay") : paymentMethod === "wechat" ? t("payment.wechat") : paymentMethod

  // Countdown timer
  useEffect(() => {
    if (status !== "PENDING") return
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
  }, [status])

  // Auto polling for payment status
  useEffect(() => {
    if (status !== "PENDING") return
    const poll = setInterval(async () => {
      try {
        const result = await withMockFallback(
          () => orderApi.getStatus(orderId),
          () => ({ order_id: orderId, status: "PENDING" as const, expires_at: "" })
        )
        if (result.status !== "PENDING") {
          setStatus(result.status)
        }
      } catch {
        // silent — continue polling
      }
    }, POLL_INTERVAL)
    return () => clearInterval(poll)
  }, [status, orderId])

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
        () => ({ order_id: orderId, status: "PENDING" as const, expires_at: "" })
      )
      if (result.status !== "PENDING") {
        setStatus(result.status)
      }
    } catch {
      // silent
    } finally {
      setIsRefreshing(false)
      setRefreshCooldown(MANUAL_REFRESH_COOLDOWN)
      toast.info(t("payment.statusRefreshed"))
    }
  }, [refreshCooldown, isRefreshing, orderId, t])

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60)
    const s = seconds % 60
    return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`
  }

  // Success state
  if (status === "PAID" || status === "DELIVERED") {
    return (
      <div className="mx-auto flex max-w-md flex-col items-center py-16">
        <div className="mb-4 rounded-full bg-emerald-100 p-4 dark:bg-emerald-900/30">
          <CheckCircle2 className="h-12 w-12 text-emerald-600 dark:text-emerald-400" />
        </div>
        <h1 className="mb-2 text-xl font-bold text-foreground">{t("payment.success")}</h1>
        <p className="mb-6 text-sm text-muted-foreground">{t("payment.successDesc")}</p>
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
      <h1 className="text-xl font-bold text-foreground">{t("payment.waiting")}</h1>

      {/* Timer */}
      <div className="flex items-center gap-2 text-muted-foreground">
        <Clock className="h-4 w-4" />
        <span className="text-sm">{t("payment.remaining")}</span>
        <span
          className={cn(
            "font-mono text-lg font-bold",
            timeLeft < 120 ? "text-destructive" : "text-foreground"
          )}
        >
          {formatTime(timeLeft)}
        </span>
      </div>

      {/* QR Code Area */}
      <div className="flex w-full flex-col items-center gap-4 rounded-lg border border-border bg-card p-6">
        <p className="text-sm text-muted-foreground">{t("payment.scanToPay")}</p>

        {/* Mock QR Code */}
        <div className="flex h-48 w-48 items-center justify-center rounded-lg border-2 border-dashed border-border bg-muted">
          <QrCode className="h-20 w-20 text-muted-foreground/40" />
        </div>

        {/* Detecting Status */}
        <p className="animate-pulse text-xs text-primary">
          {t("payment.detecting")}
        </p>

        {/* Order Info */}
        <div className="flex w-full flex-col gap-2 pt-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">{t("payment.method")}</span>
            <span className="flex items-center gap-2 font-medium text-foreground">
              <PaymentIcon method={paymentMethod} className="h-5 w-5" />
              {paymentMethodName}
            </span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">{t("payment.orderNo")}</span>
            <span className="flex items-center gap-1 font-mono text-xs text-foreground">
              {orderId.length > 20 ? `${orderId.slice(0, 8)}...${orderId.slice(-8)}` : orderId}
              <button
                onClick={() => {
                  navigator.clipboard.writeText(orderId)
                  toast.success(t("order.copied"))
                }}
                className="text-muted-foreground hover:text-foreground"
              >
                <Copy className="h-3.5 w-3.5" />
              </button>
            </span>
          </div>
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
          <a
            href="https://t.me/yoursupport"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 text-muted-foreground underline-offset-4 transition-colors hover:text-foreground hover:underline"
          >
            {t("payment.contactSupport")}
            <ExternalLink className="h-3 w-3" />
          </a>
        </div>
      </div>
    </div>
  )
}
