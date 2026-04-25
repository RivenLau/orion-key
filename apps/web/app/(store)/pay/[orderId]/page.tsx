"use client"

import { useState, useEffect, useCallback } from "react"
import { use } from "react"
import Link from "next/link"
import { useSearchParams, useRouter } from "next/navigation"
import {
  Clock,
  CheckCircle2,
  XCircle,
  Copy,
  ExternalLink,
  HelpCircle,
  Loader2,
  ArrowRight,
} from "lucide-react"
import { toast } from "sonner"
import { useLocale, useCart, useSiteConfig } from "@/lib/context"
import { orderApi } from "@/services/api"
import type { OrderStatus } from "@/types"
import { cn } from "@/lib/utils"
import { PaymentIcon, getPaymentLabel, getPaymentBrandColor, getPaymentScanHint } from "@/components/shared/payment-icon"

const POLL_INTERVAL = 3000 // 3 seconds
// [DEMO] 静态二维码图片路径 — 4 个支付渠道共用一张
const DEMO_QR_IMAGE = "/demo/payment-qr-demo.png"

export default function PaymentPage({ params }: { params: Promise<{ orderId: string }> }) {
  const { orderId } = use(params)
  const { t } = useLocale()
  const { config } = useSiteConfig()
  const searchParams = useSearchParams()

  const router = useRouter()
  const { refreshCart } = useCart()

  const [status, setStatus] = useState<OrderStatus>("PENDING")
  const [timeLeft, setTimeLeft] = useState(-1) // -1 = 等待服务端返回真实倒计时，避免闪屏
  const [isMocking, setIsMocking] = useState(false)

  const paymentMethod = searchParams.get("method") || "alipay"
  const paymentMethodName = getPaymentLabel(paymentMethod, t)
  const scanHint = getPaymentScanHint(paymentMethod, t)
  const brandColor = getPaymentBrandColor(paymentMethod)

  // USDT 支付判断 & 参数
  const isUsdtPayment = paymentMethod.startsWith("usdt_")
  const walletAddress = searchParams.get("wallet") || ""
  const cryptoAmount = searchParams.get("crypto_amount") || ""
  const usdtChain = searchParams.get("chain") || paymentMethod
  const chainDisplayName = usdtChain.includes("trc20") ? "TRC-20" : usdtChain.includes("bep20") ? "BEP-20" : usdtChain

  // 初始化：获取订单真实倒计时
  useEffect(() => {
    async function fetchOrderInfo() {
      try {
        const result = await orderApi.getStatus(orderId)
        if (result.remaining_seconds !== undefined) {
          setTimeLeft(result.remaining_seconds)
        }
        if (result.status !== "PENDING") {
          setStatus(result.status)
        }
      } catch {
        // silent — 首次下单可能刚创建，保持默认倒计时
      }
    }
    fetchOrderInfo()
  }, [orderId])

  // Countdown timer — 仅在服务端返回真实倒计时后才开始递减
  // 倒计时归零时仅停止递减，不单方面设置 EXPIRED — 等待下一次轮询从服务端获取真实状态
  useEffect(() => {
    if (status !== "PENDING" || timeLeft < 0) return
    const timer = setInterval(() => {
      setTimeLeft((prev) => (prev <= 1 ? 0 : prev - 1))
    }, 1000)
    return () => clearInterval(timer)
  }, [status, timeLeft < 0])

  // Auto polling for payment status
  // 网络错误时静默跳过（不更新任何状态），等待下次轮询；避免 mock 数据污染倒计时
  useEffect(() => {
    if (status !== "PENDING") return
    const poll = setInterval(async () => {
      try {
        const result = await orderApi.getStatus(orderId)
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
        // silent — 网络抖动时继续轮询，不更新状态
      }
    }, POLL_INTERVAL)
    return () => clearInterval(poll)
  }, [status, orderId, refreshCart])

  // [DEMO] 模拟支付成功回调 — 调用后端 mock 接口直接将订单置为 PAID
  // 成功后立即把本地 status 切换到 PAID，触发 success 分支自动跳转到订单查询页（自动发货）
  const handleMockPaySuccess = useCallback(async () => {
    if (isMocking) return
    setIsMocking(true)
    try {
      const result = await orderApi.mockPaySuccess(orderId)
      setStatus(result.status)
      refreshCart()
      toast.success(t("payment.success"))
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : t("common.error")
      toast.error(msg)
    } finally {
      setIsMocking(false)
    }
  }, [isMocking, orderId, refreshCart, t])

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
  const [redirectCount, setRedirectCount] = useState(3)

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
      <div className="flex w-full flex-col items-center gap-4 rounded-xl border border-border bg-card p-6 shadow-sm">

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
          /* ========== USDT 支付视图（紧凑居中布局） ========== */
          <div className="flex w-full flex-col items-center gap-3">
            {/* ① 品牌标签 — 网络类型 */}
            <div className="my-0.5 inline-flex items-center gap-2 rounded-full border border-emerald-100 bg-emerald-50 px-4 py-1.5 transition-all duration-200">
              <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-500" />
              <span className="text-sm font-medium text-emerald-700">{paymentMethodName}</span>
            </div>

            {/* ②③ 转账金额 + 收款地址 — 合并卡片 */}
            <div className="flex w-full max-w-sm flex-col rounded-xl border border-border/60 bg-card shadow-sm transition-all duration-200 hover:border-border hover:shadow-md">
              {/* 转账金额 */}
              <div className="flex flex-col gap-1 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-2">
                <span className="text-sm text-muted-foreground">{t("payment.usdt.amount")}（{t("payment.usdt.amountHint")}）</span>
                <span className="flex items-center gap-2">
                  <span
                    className="cursor-pointer text-lg font-bold text-foreground underline-offset-4 transition-all hover:underline hover:text-primary"
                    onClick={() => copyToClipboard(cryptoAmount)}
                  >
                    {cryptoAmount} USDT
                  </span>
                  <button type="button" onClick={() => copyToClipboard(cryptoAmount)}
                          className="shrink-0 text-muted-foreground transition-colors hover:text-foreground">
                    <Copy className="h-4 w-4" />
                  </button>
                </span>
              </div>
              {/* 分割线 */}
              <div className="mx-4 border-t border-border/40" />
              {/* 收款地址 */}
              <div className="flex flex-col gap-1 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-2">
                <span className="text-sm text-muted-foreground">{t("payment.usdt.address")}</span>
                <span className="flex items-center gap-2">
                  <span
                    className="cursor-pointer font-mono text-sm font-normal text-foreground underline-offset-4 transition-all hover:underline hover:text-primary"
                    title={walletAddress}
                    onClick={() => copyToClipboard(walletAddress)}
                  >
                    {walletAddress.length > 28
                      ? `${walletAddress.slice(0, 12)}...${walletAddress.slice(-12)}`
                      : walletAddress}
                  </span>
                  <button type="button" onClick={() => copyToClipboard(walletAddress)}
                          className="shrink-0 text-muted-foreground transition-colors hover:text-foreground">
                    <Copy className="h-4 w-4" />
                  </button>
                </span>
              </div>
            </div>

            {/* ④ QR Code — 品牌色微渲染，响应式尺寸 */}
            <div
              className="flex items-center justify-center rounded-2xl p-3 transition-all duration-200 hover:shadow-md"
              style={{
                backgroundColor: `color-mix(in srgb, ${brandColor || "#26A17B"} 4%, var(--card))`,
                boxShadow: `inset 0 0 0 1px color-mix(in srgb, ${brandColor || "#26A17B"} 12%, transparent)`,
              }}
            >
              {/* [DEMO] 静态二维码图片，扫描后提示用户点击下方"模拟支付成功回调"按钮 */}
              <div className="rounded-lg bg-white p-2">
                <img
                  src={DEMO_QR_IMAGE}
                  alt="Demo QR Code"
                  className="h-[140px] w-[140px] sm:h-[160px] sm:w-[160px]"
                />
              </div>
            </div>

            {/* ⑤ 警告提示 — 紧凑 */}
            <ul className="flex w-full max-w-sm flex-col gap-1 rounded-lg border border-amber-200 bg-amber-50 px-3.5 py-2.5 text-sm text-amber-800 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-200">
              <li className="flex items-start gap-1.5">
                <span className="mt-0.5 shrink-0">•</span>
                <span>{t("payment.usdt.warnExact").replace("{amount}", cryptoAmount)}</span>
              </li>
              <li className="flex items-start gap-1.5">
                <span className="mt-0.5 shrink-0">•</span>
                <span>{t("payment.usdt.warnChain").replace("{chain}", chainDisplayName)}</span>
              </li>
              <li className="flex items-start gap-1.5">
                <span className="mt-0.5 shrink-0">•</span>
                <span>{t("payment.usdt.delayHint")}</span>
              </li>
            </ul>

            {/* 检测状态 */}
            <p className="animate-pulse text-sm text-primary">{t("payment.detecting")}</p>
          </div>
        ) : (
          /* ========== 通用扫码视图（PC + 移动端共用，演示场景统一展示二维码） ========== */
          <>
            <div
              className="flex w-72 flex-col items-center gap-4 rounded-2xl px-6 pb-8 pt-6"
              style={{ backgroundColor: brandColor || "#374151" }}
            >
              <div className="flex items-center gap-2.5">
                <PaymentIcon method={paymentMethod} className="h-10 w-10" variant="plain" />
                <span className="text-xl font-bold text-white">{paymentMethodName}</span>
              </div>
              <p className="text-sm font-medium text-white/90">{scanHint}</p>
              <div className="flex h-52 w-52 items-center justify-center rounded-xl bg-white p-3">
                {/* [DEMO] 静态二维码图片，扫描后提示用户点击下方"模拟支付成功回调"按钮 */}
                <img src={DEMO_QR_IMAGE} alt="Demo QR Code" className="h-[184px] w-[184px]" />
              </div>
            </div>
            <p className="animate-pulse text-sm text-primary">{t("payment.detecting")}</p>
          </>
        )}

        {/* 订单号 */}
        <div className="flex w-full items-center justify-between border-t border-border pt-4 text-sm">
          <span className="text-muted-foreground">{t("payment.orderNo")}</span>
          <span className="flex items-center gap-1 font-mono text-sm text-foreground">
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

      {/* [DEMO] 模拟支付成功回调按钮 — 样式参考首页"立即购买" CTA，跟随主题色 */}
      <button
        onClick={handleMockPaySuccess}
        disabled={isMocking}
        className="scheme-glow inline-flex h-12 w-full max-w-sm items-center justify-center gap-2 rounded-lg bg-primary px-6 text-base font-semibold text-primary-foreground transition-all hover:brightness-110 disabled:pointer-events-none disabled:opacity-50"
      >
        {isMocking ? (
          <Loader2 className="h-5 w-5 animate-spin" />
        ) : (
          <CheckCircle2 className="h-5 w-5" />
        )}
        {isMocking ? t("payment.refreshing") : t("payment.refresh")}
      </button>

      {/* Help Links */}
      <div className="flex flex-col items-center gap-2 pt-2 text-sm">
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
