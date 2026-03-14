import { CreditCard } from "lucide-react"
import { cn } from "@/lib/utils"

interface PaymentIconProps {
  method: string
  className?: string
  /** "badge" = 原始彩色图标（列表/选择器场景）；"plain" = 白色图标（用于品牌色背景卡片上） */
  variant?: "badge" | "plain"
}

/** 统一归一化支付方式 code（大小写不敏感） */
function normalize(method: string): string {
  return method.toLowerCase()
}

/** 支付方式 code → 官方 SVG Logo 路径 */
function getLogoSrc(method: string): string | null {
  const m = normalize(method)
  if (m.includes("alipay") || m === "支付宝") return "/images/payment/ali.svg"
  if (m.includes("wechat") || m === "微信支付") return "/images/payment/wechat.svg"
  if (m.includes("usdt")) return "/images/payment/usdt.svg"
  return null
}

/** 支付方式 code → 品牌色（大小写不敏感） */
const BRAND_COLORS: Record<string, string> = {
  alipay: "#1677FF",
  wechat: "#07C160",
  usdt: "#26A17B",
  usdt_trc20: "#26A17B",
  usdt_bsc: "#26A17B",
}

export function getPaymentBrandColor(method: string): string | undefined {
  const m = normalize(method)
  if (m.includes("alipay") || m === "支付宝") return BRAND_COLORS.alipay
  if (m.includes("wechat") || m === "微信支付") return BRAND_COLORS.wechat
  if (m.includes("usdt")) return BRAND_COLORS.usdt
  return BRAND_COLORS[m]
}

/** 支付方式 code → 中文名称（不依赖 i18n，用于无 hook 的场景） */
const PAYMENT_LABELS: Record<string, string> = {
  alipay: "支付宝",
  wechat: "微信支付",
  usdt_trc20: "USDT (TRC-20)",
  usdt_erc20: "USDT (ERC-20)",
  usdt_bep20: "USDT (BEP-20)",
  usdt_bsc: "USDT (BSC)",
}

/** 获取支付方式显示名称（优先 i18n t() 翻译，无翻译时回退到内置映射；大小写不敏感） */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function getPaymentLabel(method: string, t?: (key: any) => string): string {
  const m = normalize(method)
  const isAlipay = m.includes("alipay") || m === "支付宝"
  const isWechat = m.includes("wechat") || m === "微信支付"

  if (t) {
    if (isAlipay) return t("payment.alipay")
    if (isWechat) return t("payment.wechat")
  }

  if (isAlipay) return PAYMENT_LABELS.alipay
  if (isWechat) return PAYMENT_LABELS.wechat

  if (m.includes("usdt")) {
    if (m.includes("trc20")) return PAYMENT_LABELS.usdt_trc20
    if (m.includes("erc20")) return PAYMENT_LABELS.usdt_erc20
    if (m.includes("bep20")) return PAYMENT_LABELS.usdt_bep20
    if (m.includes("bsc")) return PAYMENT_LABELS.usdt_bsc
  }

  return PAYMENT_LABELS[m] || method
}

/** 获取扫码提示文案（大小写不敏感） */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function getPaymentScanHint(method: string, t: (key: any) => string): string {
  const m = normalize(method)
  if (m.includes("alipay") || m === "支付宝") return t("payment.scanWithAlipay")
  if (m.includes("wechat") || m === "微信支付") return t("payment.scanWithWechat")
  return t("payment.scanToPay")
}

export function PaymentIcon({ method, className = "h-5 w-5", variant = "badge" }: PaymentIconProps) {
  const src = getLogoSrc(method)

  if (!src) {
    return (
      <span className={cn("inline-flex items-center justify-center rounded bg-muted", className)}>
        <CreditCard className="h-3/5 w-3/5 text-muted-foreground" />
      </span>
    )
  }

  return (
    <img
      src={src}
      alt={method}
      className={cn(className, variant === "plain" && "brightness-0 invert")}
      draggable={false}
    />
  )
}
