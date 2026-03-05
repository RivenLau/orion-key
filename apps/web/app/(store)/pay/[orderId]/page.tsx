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
  Info,
  ArrowRight,
  AlertTriangle,
  Smartphone,
} from "lucide-react"
import { QRCodeSVG } from "qrcode.react"
import { toast } from "sonner"
import { useLocale, useCart, useSiteConfig } from "@/lib/context"
import { orderApi, withMockFallback } from "@/services/api"
import type { OrderStatus } from "@/types"
import { cn, detectPaymentDevice, isMobileDevice } from "@/lib/utils"
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
  const [payUrlH5, setPayUrlH5] = useState<string>("")
  const [retrying, setRetrying] = useState(false)
  // 标记是否已经跳转过支付 App（从 sessionStorage 初始化，防止返回后文案错误）
  const [hasRedirected, setHasRedirected] = useState(false)

  const isMobile = isMobileDevice()

  const paymentMethod = searchParams.get("method") || "alipay"
  const paymentMethodName = getPaymentLabel(paymentMethod, t)
  const scanHint = getPaymentScanHint(paymentMethod, t)
  const brandColor = getPaymentBrandColor(paymentMethod)

  // USDT 支付判断 & 参数
  const isUsdtPayment = paymentMethod.startsWith("usdt_")
  // 微信移动端：不支持 H5 拉起，回退展示二维码（兼容 wechat / wxpay 等写法）
  const isWechatMobile = isMobile && ["wechat", "wxpay"].includes(paymentMethod.toLowerCase())
  const walletAddress = searchParams.get("wallet") || ""
  const cryptoAmount = searchParams.get("crypto_amount") || ""
  const usdtChain = searchParams.get("chain") || paymentMethod
  const chainDisplayName = usdtChain.includes("trc20") ? "TRC-20" : usdtChain.includes("bep20") ? "BEP-20" : usdtChain

  // 初始化：获取订单状态 + QR code + H5 pay URL + 真实倒计时
  useEffect(() => {
    const qrFromParam = searchParams.get("qr")
    if (qrFromParam) {
      setQrcodeUrl(decodeURIComponent(qrFromParam))
    }

    const payurlFromParam = searchParams.get("payurl")
    if (payurlFromParam) {
      setPayUrlH5(decodeURIComponent(payurlFromParam))
    }

    // 检查是否已跳转过支付 App（从 sessionStorage 恢复状态）
    if (sessionStorage.getItem(`pay_redirected_${orderId}`)) {
      setHasRedirected(true)
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

  // H5 自动跳转（移动端 + 有 payUrl + PENDING 状态 + 未跳转过 + 非微信）
  useEffect(() => {
    if (!isMobile || !payUrlH5 || status !== "PENDING" || isUsdtPayment || isWechatMobile) return
    const storageKey = `pay_redirected_${orderId}`
    if (sessionStorage.getItem(storageKey)) {
      setHasRedirected(true)
      return
    }
    sessionStorage.setItem(storageKey, "1")
    setHasRedirected(true)
    window.location.href = payUrlH5
  }, [isMobile, payUrlH5, status, orderId, isUsdtPayment, isWechatMobile])

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

  // 重新发起支付（移动端重试）
  const handleRetryPayment = useCallback(async () => {
    if (retrying) return
    setRetrying(true)
    try {
      const device = detectPaymentDevice()
      const result = await orderApi.repay(orderId, device)
      // 更新支付链接
      if (result.pay_url) setPayUrlH5(result.pay_url)
      if (result.qrcode_url) setQrcodeUrl(result.qrcode_url)
      else if (result.payment_url) setQrcodeUrl(result.payment_url)

      if (isMobile && result.pay_url) {
        // 清除跳转标记，允许重新跳转
        sessionStorage.removeItem(`pay_redirected_${orderId}`)
        window.location.href = result.pay_url
      } else {
        toast.success(t("payment.statusRefreshed"))
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : t("common.error")
      toast.error(msg)
    } finally {
      setRetrying(false)
    }
  }, [retrying, orderId, isMobile, t])

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

        {isUsdtPayment ? (
          /* ========== USDT 支付视图 ========== */
          <>
            <div
              className="flex w-full max-w-sm flex-col items-center gap-4 rounded-2xl px-6 pb-6 pt-6"
              style={{ backgroundColor: brandColor || "#26A17B" }}
            >
              {/* 品牌标题 */}
              <div className="flex items-center gap-2.5">
                <PaymentIcon method={paymentMethod} className="h-10 w-10" variant="plain" />
                <span className="text-xl font-bold text-white">{paymentMethodName}</span>
              </div>

              <div className="flex w-full flex-col items-center gap-4 sm:flex-row sm:items-start sm:gap-5">
                {/* QR Code（钱包地址） */}
                <div className="flex h-44 w-44 shrink-0 items-center justify-center rounded-xl bg-white p-2.5">
                  {walletAddress ? (
                    <QRCodeSVG value={walletAddress} size={160} level="M" includeMargin={false} />
                  ) : (
                    <div className="flex flex-col items-center gap-2 text-muted-foreground">
                      <Loader2 className="h-8 w-8 animate-spin" />
                      <span className="text-xs">{t("common.loading")}</span>
                    </div>
                  )}
                </div>

                {/* 金额 + 地址 */}
                <div className="flex flex-col gap-3 text-white">
                  {/* 转账金额 */}
                  <div>
                    <p className="text-xs font-medium text-white/70">{t("payment.usdt.amount")}</p>
                    <div className="mt-1 flex items-center gap-2">
                      <span className="text-lg font-bold">{cryptoAmount} USDT</span>
                      <button type="button" onClick={() => copyToClipboard(cryptoAmount)}
                              className="text-white/70 transition-colors hover:text-white">
                        <Copy className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                  {/* 收款地址 */}
                  <div>
                    <p className="text-xs font-medium text-white/70">{t("payment.usdt.address")}</p>
                    <div className="mt-1 flex items-center gap-2">
                      <span className="break-all text-xs font-mono leading-relaxed">
                        {walletAddress.length > 20
                          ? `${walletAddress.slice(0, 10)}...${walletAddress.slice(-10)}`
                          : walletAddress}
                      </span>
                      <button type="button" onClick={() => copyToClipboard(walletAddress)}
                              className="shrink-0 text-white/70 transition-colors hover:text-white">
                        <Copy className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* USDT 警告提示 */}
            <div className="flex w-full max-w-sm flex-col gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-200">
              <p className="flex items-start gap-1.5">
                <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                <span>{t("payment.usdt.warnExact").replace("{amount}", cryptoAmount)}</span>
              </p>
              <p className="flex items-start gap-1.5">
                <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                <span>{t("payment.usdt.warnFee")}</span>
              </p>
              <p className="flex items-start gap-1.5">
                <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                <span>{t("payment.usdt.warnChain").replace("{chain}", chainDisplayName)}</span>
              </p>
            </div>

            {/* 检测状态 */}
            <p className="animate-pulse text-sm text-primary">{t("payment.detecting")}</p>
          </>
        ) : (!isMobile || isWechatMobile) ? (
          /* ========== PC / 微信移动端 — 二维码视图 ========== */
          <>
            <div
              className="flex w-72 flex-col items-center gap-4 rounded-2xl px-6 pb-8 pt-6"
              style={{ backgroundColor: brandColor || "#374151" }}
            >
              <div className="flex items-center gap-2.5">
                <PaymentIcon method={paymentMethod} className="h-10 w-10" variant="plain" />
                <span className="text-xl font-bold text-white">{paymentMethodName}</span>
              </div>
              <p className="text-sm font-medium text-white/90">
                {isWechatMobile ? t("payment.wechatMobileScanHint") : scanHint}
              </p>
              <div className="flex h-52 w-52 items-center justify-center rounded-xl bg-white p-3">
                {qrcodeUrl ? (
                  <QRCodeSVG value={qrcodeUrl} size={184} level="M" includeMargin={false} />
                ) : (
                  <div className="flex flex-col items-center gap-2 text-muted-foreground">
                    <Loader2 className="h-8 w-8 animate-spin" />
                    <span className="text-xs">{t("common.loading")}</span>
                  </div>
                )}
              </div>
            </div>
            <p className="animate-pulse text-sm text-primary">{t("payment.detecting")}</p>

            {/* 刷新二维码按钮 */}
            <button
              onClick={handleRetryPayment}
              disabled={retrying}
              className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-primary disabled:opacity-50"
            >
              {retrying ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <RefreshCw className="h-3.5 w-3.5" />
              )}
              {t("payment.refreshQrCode")}
            </button>
          </>
        ) : (
          /* ========== H5 移动端支付视图（新增） ========== */
          <>
            <div
              className="flex w-full max-w-sm flex-col items-center gap-4 rounded-2xl px-6 pb-6 pt-6"
              style={{ backgroundColor: brandColor || "#374151" }}
            >
              <div className="flex items-center gap-2.5">
                <PaymentIcon method={paymentMethod} className="h-10 w-10" variant="plain" />
                <span className="text-xl font-bold text-white">{paymentMethodName}</span>
              </div>
              <Smartphone className="h-8 w-8 text-white/80" />
            </div>

            {/* 状态提示：未跳转过 → "正在跳转..."；已跳转返回 → "如已完成支付..." */}
            {!hasRedirected ? (
              <p className="animate-pulse text-sm text-primary">{t("payment.redirectingToPay")}</p>
            ) : (
              <p className="text-sm text-muted-foreground">{t("payment.returnedFromPay")}</p>
            )}

            {/* 检测状态 */}
            <p className="animate-pulse text-sm text-primary">{t("payment.detecting")}</p>

            {/* 重新发起支付按钮 */}
            <button
              onClick={handleRetryPayment}
              disabled={retrying}
              className="inline-flex h-10 items-center gap-2 rounded-lg bg-primary px-5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:pointer-events-none disabled:opacity-50"
            >
              {retrying ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4" />
              )}
              {t("payment.retryPay")}
            </button>
          </>
        )}

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
      <div className="flex flex-col items-center gap-2 pt-2 text-sm">
        {/* USDT 延迟到账提示 */}
        {isUsdtPayment && (
          <p className="flex items-start gap-1.5 text-muted-foreground">
            <Info className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{t("payment.usdt.delayHint")}</span>
          </p>
        )}

        {/* 引导跳转订单查询 — 携带 orderId */}
        <Link
          href={`/order/query?orderId=${orderId}`}
          className="text-muted-foreground transition-colors hover:text-foreground"
        >
          {t("payment.completedPayment")}
          <span className="font-medium text-foreground">{t("payment.goQueryOrder")}</span>
          <ArrowRight className="ml-0.5 inline h-4 w-4" />
        </Link>

        {/* 联系客服 */}
        {(config?.contact_telegram || config?.contact_email) && (
          <div className="flex flex-wrap items-center justify-center gap-x-1 text-muted-foreground">
            <HelpCircle className="h-3.5 w-3.5" />
            <span>{t("payment.needHelp")}</span>
            {config.contact_telegram && (
              <a
                href={config.contact_telegram}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-0.5 underline-offset-4 transition-colors hover:text-foreground hover:underline"
              >
                {t("payment.contactSupport")}
                <ExternalLink className="h-3.5 w-3.5" />
              </a>
            )}
            {config.contact_telegram && config.contact_email && (
              <span>·</span>
            )}
            {config.contact_email && (
              <a
                href={`mailto:${config.contact_email}`}
                className="underline-offset-4 transition-colors hover:text-foreground hover:underline"
              >
                {t("order.contactEmail")}
              </a>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
