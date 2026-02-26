/**
 * 服务端数据获取工具（仅用于 Server Component）
 *
 * 与客户端 api.ts 的区别：
 * - 直接使用 BACKEND_URL 调用后端，不走 Next.js rewrites 代理
 * - 不依赖 localStorage（服务端无浏览器环境）
 * - 仅封装公开接口（不需要 auth token）
 */

import type {
  ApiResponse,
  PaginatedData,
  ProductCard,
  ProductDetail,
  Category,
  PaymentChannelItem,
  SiteConfig,
  CurrencyItem,
} from "@/types"

// 后端直连地址（Docker 内部网络或本地开发）
const BACKEND_URL = process.env.BACKEND_URL || "http://localhost:8083"

// ============================================================
// Core request
// ============================================================

async function serverRequest<T>(path: string): Promise<T> {
  const res = await fetch(`${BACKEND_URL}/api${path}`, {
    headers: { "Content-Type": "application/json" },
    cache: "no-store",
  })

  if (!res.ok) {
    throw new Error(`Server API error: ${res.status} ${res.statusText} [${path}]`)
  }

  const body: ApiResponse<T> = await res.json()

  if (body.code !== 0) {
    throw new Error(body.message || `API error code: ${body.code}`)
  }

  return body.data
}

// ============================================================
// Public API — 商品
// ============================================================

export async function getProducts(params?: {
  page?: number
  page_size?: number
  category_id?: string
  keyword?: string
}): Promise<PaginatedData<ProductCard>> {
  const sp = new URLSearchParams()
  if (params?.page) sp.set("page", String(params.page))
  if (params?.page_size) sp.set("page_size", String(params.page_size))
  if (params?.category_id) sp.set("category_id", params.category_id)
  if (params?.keyword) sp.set("keyword", params.keyword)
  const qs = sp.toString()
  return serverRequest<PaginatedData<ProductCard>>(
    `/products${qs ? `?${qs}` : ""}`
  )
}

export async function getProductDetail(id: string): Promise<ProductDetail> {
  return serverRequest<ProductDetail>(`/products/${id}`)
}

// ============================================================
// Public API — 分类
// ============================================================

export async function getCategories(): Promise<Category[]> {
  return serverRequest<Category[]>("/categories")
}

// ============================================================
// Public API — 支付渠道
// ============================================================

export async function getPaymentChannels(): Promise<PaymentChannelItem[]> {
  return serverRequest<PaymentChannelItem[]>("/payment-channels")
}

// ============================================================
// Public API — 站点配置
// ============================================================

export async function getSiteConfig(): Promise<SiteConfig> {
  return serverRequest<SiteConfig>("/site/config")
}

// ============================================================
// Public API — 货币
// ============================================================

export async function getCurrencies(): Promise<CurrencyItem[]> {
  return serverRequest<CurrencyItem[]>("/currencies")
}
