// ============================================================
// API Response Types
// ============================================================

export interface ApiResponse<T = unknown> {
  code: number
  message: string
  data: T
  params?: Record<string, string | number>
}

export interface Pagination {
  page: number
  page_size: number
  total: number
}

export interface PaginatedData<T> {
  list: T[]
  pagination: Pagination
}

// ============================================================
// Auth
// ============================================================

export interface LoginRequest {
  account: string
  password: string
}

export interface RegisterRequest {
  username: string
  password: string
  email: string
  captcha_id: string
  captcha: string
}

export interface CaptchaResult {
  captcha_id: string
  captcha_image: string
}

export interface AuthResult {
  token: string
  user: UserProfile
}

export interface UserProfile {
  id: string
  username: string
  email: string
  role: 'USER' | 'ADMIN'
  points: number
  created_at: string
}

// ============================================================
// Product & Category
// ============================================================

export interface Category {
  id: string
  name: string
  sort_order: number
}

export interface ProductSpec {
  id: string
  name: string
  price: number
  stock_available: number
  is_visible?: boolean
  sort_order?: number
}

export interface WholesaleRule {
  min_quantity: number
  unit_price: number
}

/** Product list item (returned by GET /products) */
export interface ProductCard {
  id: string
  title: string
  description?: string
  cover_url?: string
  base_price: number
  currency?: string
  category_id: string
  stock_available: number
  has_specs: boolean
  delivery_type?: string
  sales_count?: number
  initial_sales?: number
  is_enabled?: boolean
  sort_order?: number
  created_at?: string
}

/** Full product detail (returned by GET /products/{id}) */
export interface ProductDetail extends ProductCard {
  detail_md?: string
  specs: ProductSpec[]
  wholesale_enabled: boolean
  wholesale_rules: WholesaleRule[]
  low_stock_threshold?: number
  category_name?: string
  updated_at?: string
}

// ============================================================
// Cart
// ============================================================

export interface CartItem {
  id: string
  product_id: string
  spec_id: string | null
  product_title: string
  spec_name: string | null
  cover_url?: string
  currency?: string
  unit_price: number
  quantity: number
  subtotal: number
  stock_available?: number
}

export interface Cart {
  items: CartItem[]
  total_amount: number
}

// ============================================================
// Order
// ============================================================

export type OrderStatus = 'PENDING' | 'PAID' | 'DELIVERED' | 'EXPIRED'

export type OrderType = 'DIRECT' | 'CART'

export interface OrderBrief {
  id: string
  total_amount: number
  actual_amount: number
  status: OrderStatus
  order_type: OrderType
  payment_method: string
  created_at: string
  // USDT 支付字段（仅 USDT 订单返回）
  usdt_tx_id?: string
}

export interface OrderItemDetail {
  id: string
  product_id: string
  product_title: string
  spec_name: string | null
  quantity: number
  unit_price: number
  subtotal: number
}

export interface OrderDetail extends OrderBrief {
  email: string
  points_deducted: number
  points_discount: number
  expires_at: string
  paid_at: string | null
  delivered_at: string | null
  items: OrderItemDetail[]
}

export interface PaymentCreateResult {
  order_id: string
  payment_url: string
  qrcode_url?: string
  pay_url?: string
  expires_at: string
  // USDT 新增（仅 USDT 渠道返回）
  wallet_address?: string
  crypto_amount?: string
  chain?: string
}

export interface TxidVerifyResult {
  result: "AUTO_APPROVED" | "AUTO_REJECTED" | "PENDING_REVIEW"
  reason: string
}

export interface CreateOrderResult {
  order: OrderDetail
  payment: PaymentCreateResult
}

export interface DeliverResultGroup {
  product_title: string
  spec_name: string | null
  card_keys: string[]
}

export interface DeliverResult {
  order_id: string
  status: OrderStatus
  groups: DeliverResultGroup[]
}

// ============================================================
// Currency
// ============================================================

export interface CurrencyItem {
  code: string
  name: string
  symbol: string
}

// ============================================================
// Payment
// ============================================================

export type ProviderType = 'epay' | 'native_alipay' | 'native_wxpay' | 'usdt'

export interface PaymentChannelConfig {
  // 易支付
  pid?: string
  key?: string
  api_url?: string
  notify_url?: string
  return_url?: string
  // 原生支付宝
  appid?: string
  private_key?: string
  alipay_public_key?: string
  gateway_url?: string
  // 原生微信
  mchid?: string
  api_v3_key?: string
  serial_no?: string
  private_key_path?: string
  // USDT
  wallet_address?: string
  rate_api_url?: string
  [key: string]: string | undefined
}

export interface PaymentChannelItem {
  id: string
  channel_code: string
  channel_name: string
  provider_type: ProviderType
  config_data?: PaymentChannelConfig | null
  is_enabled: boolean
  sort_order: number
  created_at: string
}

// ============================================================
// Site Config
// ============================================================

export interface SiteConfig {
  site_name: string
  site_slogan?: string
  site_description?: string
  logo_url?: string
  favicon_url?: string
  announcement_enabled: boolean
  announcement?: string
  popup_enabled: boolean
  popup_content?: string
  contact_email?: string
  contact_telegram?: string
  points_enabled: boolean
  points_rate: number
  maintenance_enabled: boolean
  maintenance_message?: string
  footer_text?: string
  github_url?: string
  custom_css?: string
}

export interface SiteConfigKV {
  config_key: string
  config_value: string
  config_group?: string
}

// ============================================================
// Create Order Requests
// ============================================================

export interface CreateOrderRequest {
  product_id: string
  spec_id: string | null
  quantity: number
  email: string
  payment_method: string
  use_points?: boolean
  idempotency_key: string
  device?: string
}

export interface CreateCartOrderRequest {
  email: string
  payment_method: string
  use_points?: boolean
  idempotency_key: string
  device?: string
}

// ============================================================
// Points
// ============================================================

export interface PointRecord {
  change_amount: number
  balance_after: number
  reason: string
  order_id: string | null
  created_at: string
}

export interface PointsData {
  total_points: number
  list: PointRecord[]
  pagination: Pagination
}

// ============================================================
// Admin Dashboard
// ============================================================

export interface LowStockProduct {
  product_id: string
  title: string
  available_stock: number
  threshold: number
}

export interface DashboardStats {
  today_sales: number
  month_sales: number
  today_orders: number
  month_orders: number
  conversion_rate: number
  today_pv: number
  today_uv: number
  low_stock_products: LowStockProduct[]
}

export interface SalesTrend {
  date: string
  sales_amount: number
  order_count: number
}

// ============================================================
// Admin Card Keys
// ============================================================

export interface CardKeyStockSummary {
  product_id: string
  product_title: string
  spec_id: string | null
  spec_name: string | null
  total: number
  available: number
  sold: number
  locked: number
  invalid: number
}

export interface CardKeyListItem {
  id: string
  content: string
  status: 'AVAILABLE' | 'LOCKED' | 'SOLD' | 'INVALID'
  order_id: string | null
  created_at: string
  sold_at: string | null
}

export interface CardImportBatch {
  id: string
  product_id: string
  spec_id: string | null
  imported_by: string
  total_count: number
  success_count: number
  fail_count: number
  fail_detail: string | null
  created_at: string
}

export interface OrderCardKey {
  card_key_id: string
  content: string
  product_title: string
  spec_name: string | null
  status: 'AVAILABLE' | 'LOCKED' | 'SOLD' | 'INVALID'
}

// ============================================================
// Admin Orders
// ============================================================

export interface AdminOrderItem extends OrderDetail {
  user_id: string | null
  username: string | null
  is_risk_flagged: boolean
}

// ============================================================
// Admin Users
// ============================================================

export interface AdminUserItem {
  id: string
  username: string
  email: string
  role: string
  points: number
  is_deleted: 0 | 1
  created_at: string
}

// ============================================================
// Admin Operation Logs
// ============================================================

export interface OperationLog {
  id: string
  user_id: string
  username: string
  action: string
  target_type: string
  target_id?: string
  detail?: string
  ip_address: string
  created_at: string
}

// ============================================================
// Admin Risk
// ============================================================

export interface RiskConfig {
  rate_limit_per_second: number
  login_attempt_limit: number
  max_purchase_per_user: number
  max_pending_orders_per_ip: number
  max_pending_orders_per_user: number
  order_expire_minutes: number
}

// ============================================================
// Admin TXID Review
// ============================================================

export type TxidReviewStatus = 'PENDING_REVIEW' | 'AUTO_APPROVED' | 'AUTO_REJECTED' | 'APPROVED' | 'REJECTED'

export interface UnmatchedTransaction {
  id: string
  order_id: string
  txid: string
  chain: string | null
  on_chain_from: string | null
  on_chain_to: string | null
  on_chain_amount: number | null
  expected_amount: number
  amount_diff: number | null
  source: 'USER_SUBMIT' | 'WEBHOOK_MISMATCH'
  status: TxidReviewStatus
  verify_reason: string | null
  reviewer_id: string | null
  reviewed_at: string | null
  submitted_at: string
  created_at: string
}
