import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function validateEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

export function generateIdempotencyKey(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID()
  }
  // Fallback for older environments
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0
    const v = c === "x" ? r : (r & 0x3) | 0x8
    return v.toString(16)
  })
}

// Dynamic currency symbol cache (populated from API via initCurrencySymbols)
let currencySymbolMap: Record<string, string> = {}

export function initCurrencySymbols(currencies: { code: string; symbol: string }[]) {
  currencySymbolMap = {}
  for (const c of currencies) {
    currencySymbolMap[c.code] = c.symbol
  }
}

export function getCurrencySymbol(currency?: string): string {
  if (currency && currencySymbolMap[currency]) {
    return currencySymbolMap[currency]
  }
  // Static fallback for common currencies
  switch (currency) {
    case "USD": return "$"
    case "USDT": return "₮"
    case "EUR": return "€"
    case "GBP": return "£"
    case "JPY": return "¥"
    case "CNY":
    default: return "¥"
  }
}

export function formatPrice(amount: number, currency?: string): string {
  return `${getCurrencySymbol(currency)}${amount.toFixed(2)}`
}

export function detectPaymentDevice(): string {
  if (typeof window === 'undefined') return 'pc'
  const ua = navigator.userAgent.toLowerCase()
  if (ua.includes('micromessenger')) return 'wechat'
  if (ua.includes('alipayclient') || ua.includes('alipay')) return 'alipay'
  if (/android|iphone|ipad|ipod|mobile/i.test(ua)) return 'mobile'
  return 'pc'
}

export function isMobileDevice(): boolean {
  return detectPaymentDevice() !== 'pc'
}

/** Strip invisible Unicode control characters (direction marks, zero-width chars, BOM) */
export function stripInvisible(text: string): string {
  return text.replace(/[\u200B-\u200F\u2060\uFEFF]/g, '')
}

export function formatDateTime(iso: string, locale?: string): string {
  try {
    const date = new Date(iso)
    return date.toLocaleString(locale === "en" ? "en-US" : "zh-CN", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    })
  } catch {
    return iso
  }
}
