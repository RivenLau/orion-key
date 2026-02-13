import { CreditCard } from "lucide-react"

interface PaymentIconProps {
  method: string
  className?: string
}

export function PaymentIcon({ method, className = "h-5 w-5" }: PaymentIconProps) {
  const isAlipay = method.toLowerCase().includes("alipay") || method === "支付宝"
  const isWechat = method.toLowerCase().includes("wechat") || method === "微信支付"

  if (isAlipay) {
    return (
      <svg viewBox="0 0 24 24" className={className}>
        <rect width="24" height="24" rx="4" fill="#1677FF" />
        <path
          d="M8 18.3c-1.1-.3-2-.8-2.6-1.4.4-.2.9-.4 1.4-.7 1.8-.9 3.1-2 4-3.3H6.5v-.8h3.3v-.7H6.5V10h3.3V8.7H8.2V8h1.6V6.5h.9V8h1.7v.7h-1.7v1.4h3.6v.7h-3.6v.7h3.8v.8h-2c-.5 1.5-1.3 2.8-2.6 3.8 1.1.3 2.5.5 4.1.5-0.4.3-.7.7-.9 1.2-1.9-.1-3.4-.5-4.6-1.1"
          fill="white"
        />
      </svg>
    )
  }

  if (isWechat) {
    return (
      <svg viewBox="0 0 24 24" className={className}>
        <rect width="24" height="24" rx="4" fill="#07C160" />
        <path
          d="M8.5 9.5c-.3 0-.5-.2-.5-.5s.2-.5.5-.5.5.2.5.5-.2.5-.5.5zm4 0c-.3 0-.5-.2-.5-.5s.2-.5.5-.5.5.2.5.5-.2.5-.5.5zm3.1 3.4c.2 0 .4.2.4.4s-.2.4-.4.4-.4-.2-.4-.4.2-.4.4-.4zm-2.8 0c.2 0 .4.2.4.4s-.2.4-.4.4-.4-.2-.4-.4.2-.4.4-.4zm5.7-.4c0-2.8-2.8-5.1-6.3-5.1S6 9.7 6 12.5c0 1.5.8 2.9 2.1 3.9l-.5 1.5 1.7-1c.6.2 1.2.3 1.9.3 3.5 0 6.3-2.3 6.3-5.1z"
          fill="white"
        />
      </svg>
    )
  }

  return (
    <div className={`flex items-center justify-center rounded bg-muted ${className}`}>
      <CreditCard className="h-3 w-3 text-muted-foreground" />
    </div>
  )
}
