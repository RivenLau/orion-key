import type {
  ApiResponse,
  PaginatedData,
  UserProfile,
  OrderBrief,
  OrderDetail,
  OrderStatus,
  PointRecord,
  PointsData,
  ProductCard,
  ProductDetail,
  ProductSpec,
  Category,
  Cart,
  CreateOrderRequest,
  CreateCartOrderRequest,
  CreateOrderResult,
  DeliverResult,
  SiteConfig,
  SiteConfigKV,
  DashboardStats,
  SalesTrend,
  CardKeyStockSummary,
  CardKeyListItem,
  CardImportBatch,
  OrderCardKey,
  AdminUserItem,
  AdminOrderItem,
  PaymentChannelItem,
  OperationLog,
  RiskConfig,
  WholesaleRule,
  CaptchaResult,
  AuthResult,
  CurrencyItem,
} from "@/types"

// ============================================================
// Config
// ============================================================

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || "/api"

// ============================================================
// Error
// ============================================================

class ApiError extends Error {
  code: number
  params?: Record<string, string | number>
  constructor(code: number, message: string, params?: Record<string, string | number>) {
    super(message)
    this.code = code
    this.params = params
    this.name = "ApiError"
  }
}

// ============================================================
// Token management
// ============================================================

function getToken(): string | null {
  if (typeof window === "undefined") return null
  return localStorage.getItem("auth_token")
}

export function setToken(token: string) {
  localStorage.setItem("auth_token", token)
}

export function clearToken() {
  localStorage.removeItem("auth_token")
}

/**
 * JWT 过期/无效时：清除本地登录态，跳转登录页
 * 使用防抖避免多个并发请求同时触发多次跳转
 */
let redirecting = false
function handleUnauthorized() {
  if (typeof window === "undefined" || redirecting) return
  redirecting = true
  clearToken()
  localStorage.removeItem("userProfile")
  const currentPath = window.location.pathname
  // 已经在登录页则不再跳转
  if (currentPath === "/login") {
    redirecting = false
    return
  }
  window.location.href = `/login?redirect=${encodeURIComponent(currentPath)}`
}

// ============================================================
// Session Token (guest cart)
// ============================================================

function getSessionToken(): string | null {
  if (typeof window === "undefined") return null
  return localStorage.getItem("session_token")
}

function setSessionToken(token: string) {
  localStorage.setItem("session_token", token)
}

export function clearSessionToken() {
  localStorage.removeItem("session_token")
}

// ============================================================
// Query builder
// ============================================================

function buildQuery(params: Record<string, string | number | boolean | undefined | null>): string {
  const sp = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== "") {
      sp.set(key, String(value))
    }
  }
  return sp.toString()
}

// ============================================================
// Core request
// ============================================================

async function request<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const token = getToken()
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  }

  if (token) {
    headers["Authorization"] = `Bearer ${token}`
  }
  // 始终发送 session token（购物车等功能需要：JWT 无效/过期时作为身份回退）
  const sessionToken = getSessionToken()
  if (sessionToken) {
    headers["X-Session-Token"] = sessionToken
  }

  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
  })

  // Capture session token from response
  const newSessionToken = res.headers.get("X-Session-Token")
  if (newSessionToken) {
    setSessionToken(newSessionToken)
  }

  if (!res.ok) {
    if (res.status === 401) {
      handleUnauthorized()
    }
    const body = await res.json().catch(() => ({ code: res.status, message: res.statusText }))
    throw new ApiError(body.code || res.status, body.message || res.statusText, body.params)
  }

  const body: ApiResponse<T> = await res.json()

  if (body.code !== 0) {
    throw new ApiError(body.code, body.message, body.params)
  }

  return body.data
}

async function uploadRequest<T>(path: string, formData: FormData): Promise<T> {
  const token = getToken()
  const headers: Record<string, string> = {}
  if (token) {
    headers["Authorization"] = `Bearer ${token}`
  }

  const res = await fetch(`${API_BASE}${path}`, {
    method: "POST",
    headers,
    body: formData,
  })

  if (!res.ok) {
    if (res.status === 401) {
      handleUnauthorized()
    }
    const body = await res.json().catch(() => ({ code: res.status, message: res.statusText }))
    throw new ApiError(body.code || res.status, body.message || res.statusText, body.params)
  }

  const body: ApiResponse<T> = await res.json()

  if (body.code !== 0) {
    throw new ApiError(body.code, body.message, body.params)
  }

  return body.data
}

// ============================================================
// Mock Fallback
// ============================================================

/**
 * Wraps an API call with a mock fallback.
 * Only network-level errors (TypeError from fetch) trigger fallback.
 * Business errors (ApiError with code!=0) propagate normally.
 */
export async function withMockFallback<T>(
  apiCall: () => Promise<T>,
  mockFn: () => T
): Promise<T> {
  try {
    return await apiCall()
  } catch (err) {
    if (err instanceof ApiError) {
      throw err // business error — let UI handle it
    }
    // Network error (TypeError) or unexpected — fallback to mock
    console.warn("[API] Network error, falling back to mock data:", err)
    return mockFn()
  }
}


// ============================================================
// Auth
// ============================================================

export const authApi = {
  getCaptcha: () =>
    request<CaptchaResult>("/auth/captcha"),
  register: (data: { username: string; password: string; email: string; captcha_id: string; captcha: string }) =>
    request<AuthResult>("/auth/register", { method: "POST", body: JSON.stringify(data) }),
  login: (data: { account: string; password: string }) =>
    request<AuthResult>("/auth/login", { method: "POST", body: JSON.stringify(data) }),
  logout: () =>
    request<null>("/auth/logout", { method: "POST" }),
}

// ============================================================
// User
// ============================================================

export const userApi = {
  getProfile: () =>
    request<UserProfile>("/user/profile"),
  updatePassword: (data: { old_password: string; new_password: string }) =>
    request<null>("/user/password", { method: "PUT", body: JSON.stringify(data) }),
  getOrders: (params: { page?: number; page_size?: number; status?: string }) => {
    const qs = buildQuery(params)
    return request<PaginatedData<OrderBrief>>(`/user/orders?${qs}`)
  },
  getPoints: (params: { page?: number; page_size?: number }) => {
    const qs = buildQuery(params)
    return request<PointsData>(`/user/points?${qs}`)
  },
}

// ============================================================
// Product
// ============================================================

export const productApi = {
  getList: (params: { page?: number; page_size?: number; category_id?: string; keyword?: string }) => {
    const qs = buildQuery(params)
    return request<PaginatedData<ProductCard>>(`/products?${qs}`)
  },
  getDetail: (id: string) =>
    request<ProductDetail>(`/products/${id}`),
  getCategories: () =>
    request<Category[]>("/categories"),
}

// ============================================================
// Cart
// ============================================================

export const cartApi = {
  get: () =>
    request<Cart>("/cart"),
  addItem: (data: { product_id: string; spec_id: string | null; quantity: number }) =>
    request<null>("/cart/items", { method: "POST", body: JSON.stringify(data) }),
  updateItem: (itemId: string, quantity: number) =>
    request<null>(`/cart/items/${itemId}`, { method: "PUT", body: JSON.stringify({ quantity }) }),
  removeItem: (itemId: string) =>
    request<null>(`/cart/items/${itemId}`, { method: "DELETE" }),
}

// ============================================================
// Order
// ============================================================

export const orderApi = {
  create: (data: CreateOrderRequest) =>
    request<CreateOrderResult>("/orders", { method: "POST", body: JSON.stringify(data) }),
  createFromCart: (data: CreateCartOrderRequest) =>
    request<CreateOrderResult>("/orders/from-cart", { method: "POST", body: JSON.stringify(data) }),
  getStatus: (orderId: string) =>
    request<{ order_id: string; status: OrderStatus; expires_at: string; remaining_seconds: number; payment_url?: string }>(`/orders/${orderId}/status`),
  refreshStatus: (orderId: string) =>
    request<{ status: OrderStatus }>(`/orders/${orderId}/refresh`, { method: "POST" }),
  query: (data: { order_ids?: string[]; emails?: string[] }) =>
    request<OrderBrief[]>("/orders/query", { method: "POST", body: JSON.stringify(data) }),
  deliver: (data: { order_ids: string[] }) =>
    request<DeliverResult[]>("/orders/deliver", { method: "POST", body: JSON.stringify(data) }),
  exportKeys: (orderId: string) =>
    request<string>(`/orders/${orderId}/export`),
}

// ============================================================
// Site Config (public)
// ============================================================

export const siteApi = {
  getConfig: () =>
    request<SiteConfig>("/site/config"),
}

// ============================================================
// Payment Channels (public, for store display)
// ============================================================

export const paymentApi = {
  getChannels: () =>
    request<PaymentChannelItem[]>("/payment-channels"),
}

// ============================================================
// Currencies (public)
// ============================================================

export const currencyApi = {
  getList: () =>
    request<CurrencyItem[]>("/currencies"),
}

// ============================================================
// Admin Dashboard
// ============================================================

export const adminDashboardApi = {
  getStats: () =>
    request<DashboardStats>("/admin/dashboard"),
  getSalesTrend: (params: { period?: string; start_date?: string; end_date?: string }) => {
    const qs = buildQuery(params)
    return request<SalesTrend[]>(`/admin/dashboard/sales-trend?${qs}`)
  },
}

// ============================================================
// Admin Product
// ============================================================

export const adminProductApi = {
  getList: (params: { page?: number; page_size?: number; category_id?: string; is_enabled?: number; keyword?: string }) => {
    const qs = buildQuery(params)
    return request<PaginatedData<ProductDetail>>(`/admin/products?${qs}`)
  },
  getDetail: (id: string) =>
    request<ProductDetail>(`/admin/products/${id}`),
  create: (data: {
    title: string; description?: string; detail_md?: string; cover_url?: string;
    base_price: number; category_id: string; low_stock_threshold?: number;
    wholesale_enabled?: boolean; is_enabled?: boolean; sort_order?: number
  }) =>
    request<ProductDetail>("/admin/products", { method: "POST", body: JSON.stringify(data) }),
  update: (id: string, data: Partial<{
    title: string; description: string; detail_md: string; cover_url: string;
    base_price: number; category_id: string; low_stock_threshold: number;
    wholesale_enabled: boolean; is_enabled: boolean; sort_order: number
  }>) =>
    request<null>(`/admin/products/${id}`, { method: "PUT", body: JSON.stringify(data) }),
  delete: (id: string) =>
    request<null>(`/admin/products/${id}`, { method: "DELETE" }),
  // Specs
  getSpecs: (productId: string) =>
    request<ProductSpec[]>(`/admin/products/${productId}/specs`),
  addSpec: (productId: string, data: { name: string; price: number; is_visible?: boolean; sort_order?: number }) =>
    request<ProductSpec>(`/admin/products/${productId}/specs`, { method: "POST", body: JSON.stringify(data) }),
  updateSpec: (productId: string, specId: string, data: Partial<{ name: string; price: number; is_visible: boolean; sort_order: number }>) =>
    request<null>(`/admin/products/${productId}/specs/${specId}`, { method: "PUT", body: JSON.stringify(data) }),
  deleteSpec: (productId: string, specId: string) =>
    request<null>(`/admin/products/${productId}/specs/${specId}`, { method: "DELETE" }),
  // Wholesale rules
  getWholesaleRules: (productId: string) =>
    request<WholesaleRule[]>(`/admin/products/${productId}/wholesale-rules`),
  setWholesaleRules: (productId: string, data: { spec_id?: string | null; rules: { min_quantity: number; unit_price: number }[] }) =>
    request<null>(`/admin/products/${productId}/wholesale-rules`, { method: "POST", body: JSON.stringify(data) }),
  // Image upload
  uploadImage: (file: File) => {
    const formData = new FormData()
    formData.append("file", file)
    return uploadRequest<{ url: string }>("/upload/image", formData)
  },
}

// ============================================================
// Admin Category
// ============================================================

export const adminCategoryApi = {
  getList: () =>
    request<Category[]>("/admin/categories"),
  create: (data: { name: string; sort_order?: number }) =>
    request<null>("/admin/categories", { method: "POST", body: JSON.stringify(data) }),
  update: (id: string, data: { name?: string; sort_order?: number }) =>
    request<null>(`/admin/categories/${id}`, { method: "PUT", body: JSON.stringify(data) }),
  delete: (id: string) =>
    request<null>(`/admin/categories/${id}`, { method: "DELETE" }),
}

// ============================================================
// Admin Card Keys
// ============================================================

export const adminCardKeyApi = {
  getList: (params: { product_id: string; spec_id?: string | null; page?: number; page_size?: number }) => {
    const qs = buildQuery(params)
    return request<PaginatedData<CardKeyListItem>>(`/admin/card-keys/list?${qs}`)
  },
  getStock: (params?: { product_id?: string; spec_id?: string }) => {
    const qs = buildQuery(params ?? {})
    return request<CardKeyStockSummary[]>(`/admin/card-keys/stock?${qs}`)
  },
  import: (data: { product_id: string; spec_id?: string | null; content: string }) =>
    request<CardImportBatch>("/admin/card-keys/import", { method: "POST", body: JSON.stringify(data) }),
  getImportBatches: (params: { product_id?: string; page?: number; page_size?: number }) => {
    const qs = buildQuery(params)
    return request<PaginatedData<CardImportBatch>>(`/admin/card-keys/import-batches?${qs}`)
  },
  invalidate: (id: string) =>
    request<null>(`/admin/card-keys/${id}/invalidate`, { method: "POST" }),
  batchInvalidate: (params: { product_id: string; spec_id?: string | null }) => {
    const qs = buildQuery(params)
    return request<{ invalidated_count: number }>(`/admin/card-keys/batch-invalidate?${qs}`, { method: "POST" })
  },
  getByOrder: (orderId: string) =>
    request<OrderCardKey[]>(`/admin/card-keys/by-order/${orderId}`),
}

// ============================================================
// Admin Order
// ============================================================

export const adminOrderApi = {
  getList: (params: {
    page?: number; page_size?: number; status?: string; order_type?: string;
    payment_method?: string; is_risk_flagged?: number; keyword?: string
  }) => {
    const qs = buildQuery(params)
    return request<PaginatedData<AdminOrderItem>>(`/admin/orders?${qs}`)
  },
  getDetail: (id: string) =>
    request<AdminOrderItem>(`/admin/orders/${id}`),
  markPaid: (id: string) =>
    request<null>(`/admin/orders/${id}/mark-paid`, { method: "POST" }),
}

// ============================================================
// Admin User
// ============================================================

export const adminUserApi = {
  getList: (params: { page?: number; page_size?: number; keyword?: string }) => {
    const qs = buildQuery(params)
    return request<PaginatedData<AdminUserItem>>(`/admin/users?${qs}`)
  },
  toggleStatus: (id: string, isDeleted: 0 | 1) =>
    request<null>(`/admin/users/${id}/toggle`, { method: "POST", body: JSON.stringify({ is_deleted: isDeleted }) }),
}

// ============================================================
// Admin Payment
// ============================================================

export const adminPaymentApi = {
  getList: () =>
    request<PaymentChannelItem[]>("/admin/payment-channels"),
  create: (data: { channel_code: string; channel_name: string; provider_type: string; config_data?: Record<string, unknown>; is_enabled?: boolean; sort_order?: number }) =>
    request<null>("/admin/payment-channels", { method: "POST", body: JSON.stringify(data) }),
  update: (id: string, data: Partial<{ channel_name: string; provider_type: string; config_data: Record<string, unknown>; is_enabled: boolean; sort_order: number }>) =>
    request<null>(`/admin/payment-channels/${id}`, { method: "PUT", body: JSON.stringify(data) }),
  delete: (id: string) =>
    request<null>(`/admin/payment-channels/${id}`, { method: "DELETE" }),
}

// ============================================================
// Admin Config
// ============================================================

export const adminConfigApi = {
  get: () =>
    request<SiteConfigKV[]>("/admin/site-config"),
  update: (data: { configs: { config_key: string; config_value: string }[] }) =>
    request<null>("/admin/site-config", { method: "PUT", body: JSON.stringify(data) }),
  toggleMaintenance: (enabled: boolean) =>
    request<null>("/admin/site-config/maintenance", { method: "POST", body: JSON.stringify({ enabled }) }),
}

// ============================================================
// Admin Log
// ============================================================

export const adminLogApi = {
  getList: (params: { page?: number; page_size?: number; user_id?: string; action?: string; target_type?: string; start_date?: string; end_date?: string }) => {
    const qs = buildQuery(params)
    return request<PaginatedData<OperationLog>>(`/admin/operation-logs?${qs}`)
  },
}

// ============================================================
// Admin Risk
// ============================================================

export const adminRiskApi = {
  getConfig: () =>
    request<RiskConfig>("/admin/risk-config"),
  updateConfig: (data: Partial<RiskConfig>) =>
    request<null>("/admin/risk-config", { method: "PUT", body: JSON.stringify(data) }),
  getFlaggedOrders: (params: { page?: number; page_size?: number }) => {
    const qs = buildQuery(params)
    return request<PaginatedData<AdminOrderItem>>(`/admin/risk/flagged-orders?${qs}`)
  },
}

export { ApiError }

// ============================================================
// Error code → i18n key mapping
// ============================================================

// 只映射用户可见的前台错误码，后台管理页面不映射（后台统一中文界面）
const ERROR_CODE_I18N: Record<number, string> = {
  // 通用
  10002: "error.unauthorized",
  10003: "error.forbidden",
  10005: "error.tooManyRequests",
  10006: "error.serverError",
  10007: "error.maintenance",
  // Auth
  20001: "error.usernameExists",
  20002: "error.emailExists",
  20003: "error.captchaInvalid",
  20004: "error.invalidCredentials",
  20005: "error.oldPasswordWrong",
  20006: "error.accountDisabled",
  // Product
  30001: "error.productNotFound",
  30002: "error.insufficientStock",
  30003: "error.specNotFound",
  30004: "error.purchaseLimitExceeded",
  // Order
  40001: "error.orderNotFound",
  40002: "error.orderExpired",
  40003: "error.orderNotPaid",
  40004: "error.orderOutOfStock",
  40005: "error.orderProcessing",
  40006: "error.purchaseLimitPerUser",
  40007: "error.unpaidOrderExists",
  40008: "error.cartEmpty",
  // Payment
  50001: "error.channelUnavailable",
}

/**
 * 从 API 错误中提取用户可见的提示文案。
 * 已映射 → i18n 文案 + 参数插值
 * 未映射 → 后端原始 message（兜底，不丢信息）
 * 非 ApiError → 原始 error message
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function getApiErrorMessage(err: unknown, t: (key: any) => string): string {
  if (err instanceof ApiError) {
    const i18nKey = ERROR_CODE_I18N[err.code]
    if (i18nKey) {
      let msg = t(i18nKey)
      // 参数插值: {available} → 实际值
      if (err.params) {
        for (const [k, v] of Object.entries(err.params)) {
          msg = msg.replace(`{${k}}`, String(v))
        }
      }
      return msg
    }
    // 未映射的 code → 直接返回后端原始 message（兜底，不丢信息）
    return err.message
  }
  return err instanceof Error ? err.message : t("common.error")
}
