import type {
  ProductCard,
  ProductDetail,
  Category,
  CartItem,
  Cart,
  OrderBrief,
  OrderDetail,
  DeliverResult,
  DashboardStats,
  SalesTrend,
  CardKeyStockSummary,
  CardImportBatch,
  AdminUserItem,
  OperationLog,
  PaymentChannelItem,
  SiteConfig,
  RiskConfig,
  AdminOrderItem,
  PointRecord,
  PointsData,
  PaginatedData,
  UserProfile,
  CaptchaResult,
  AuthResult,
  ProductSpec,
  OrderCardKey,
  SiteConfigKV,
  CreateOrderResult,
  PaymentCreateResult,
} from "@/types"

// ============================================================
// UUID helpers
// ============================================================

const uuid = (n: number) => `550e8400-e29b-41d4-a716-44665544${String(n).padStart(4, "0")}`

// ============================================================
// Categories
// ============================================================

export const mockCategories: Category[] = [
  { id: uuid(1), name: "游戏充值", sort_order: 1 },
  { id: uuid(2), name: "会员订阅", sort_order: 2 },
  { id: uuid(3), name: "软件激活", sort_order: 3 },
  { id: uuid(4), name: "社交媒体", sort_order: 4 },
  { id: uuid(5), name: "学习教育", sort_order: 5 },
]

// ============================================================
// Product Specs (reusable)
// ============================================================

const specSteam50: ProductSpec = { id: uuid(101), name: "50元面额", price: 48.5, stock_available: 89 }
const specNetflixMonth: ProductSpec = { id: uuid(102), name: "月卡", price: 35.0, stock_available: 45 }
const specNetflixQuarter: ProductSpec = { id: uuid(103), name: "季卡", price: 95.0, stock_available: 20 }
const specSpotifyQuarter: ProductSpec = { id: uuid(104), name: "季卡", price: 28.0, stock_available: 67 }
const specWin11Pro: ProductSpec = { id: uuid(105), name: "专业版", price: 128.0, stock_available: 156 }
const specWin11Ent: ProductSpec = { id: uuid(106), name: "企业版", price: 198.0, stock_available: 42 }
const specOffice365: ProductSpec = { id: uuid(107), name: "家庭版年卡", price: 168.0, stock_available: 34 }
const specChatGPT: ProductSpec = { id: uuid(108), name: "月卡", price: 135.0, stock_available: 23 }
const specYouTube: ProductSpec = { id: uuid(109), name: "月卡", price: 15.9, stock_available: 78 }
const specDiscordMonth: ProductSpec = { id: uuid(110), name: "Nitro 月卡", price: 29.9, stock_available: 56 }
const specDiscordYear: ProductSpec = { id: uuid(111), name: "Nitro 年卡", price: 299.0, stock_available: 12 }

// ============================================================
// Products (list level — ProductCard)
// ============================================================

export const mockProducts: ProductCard[] = [
  {
    id: uuid(11),
    title: "Steam 50元钱包充值卡",
    description: "Steam 平台 50 元人民币钱包充值码，购买后即时发货",
    cover_url: "/images/products/steam-50.jpg",
    base_price: 48.5,
    category_id: uuid(1),
    stock_available: 89,
    has_specs: true,
    sales_count: 1234,
    sort_order: 1,
    created_at: "2025-01-20T10:00:00Z",
  },
  {
    id: uuid(12),
    title: "Netflix 高级会员月卡",
    description: "Netflix Premium 高级会员 30 天，4K 超高清 + 多设备支持",
    cover_url: "/images/products/netflix-premium.jpg",
    base_price: 35.0,
    category_id: uuid(2),
    stock_available: 45,
    has_specs: true,
    sales_count: 856,
    sort_order: 2,
    created_at: "2025-01-20T10:00:00Z",
  },
  {
    id: uuid(13),
    title: "Spotify Premium 会员季卡",
    description: "Spotify Premium 会员 90 天，无广告听歌 + 离线下载",
    cover_url: "/images/products/spotify-premium.jpg",
    base_price: 28.0,
    category_id: uuid(2),
    stock_available: 67,
    has_specs: true,
    sales_count: 543,
    sort_order: 3,
    created_at: "2025-01-22T10:00:00Z",
  },
  {
    id: uuid(14),
    title: "Windows 11 Pro 专业版激活码",
    description: "微软 Windows 11 Professional 正版永久激活密钥",
    cover_url: "/images/products/windows-11-pro.jpg",
    base_price: 128.0,
    category_id: uuid(3),
    stock_available: 156,
    has_specs: true,
    sales_count: 2341,
    sort_order: 4,
    created_at: "2025-01-18T10:00:00Z",
  },
  {
    id: uuid(15),
    title: "Office 365 家庭版年卡",
    description: "Microsoft 365 Family 一年订阅，最多 6 人使用",
    cover_url: "/images/products/office-365.jpg",
    base_price: 168.0,
    category_id: uuid(3),
    stock_available: 34,
    has_specs: true,
    sales_count: 789,
    sort_order: 5,
    created_at: "2025-01-19T10:00:00Z",
  },
  {
    id: uuid(16),
    title: "ChatGPT Plus 月卡",
    description: "OpenAI ChatGPT Plus 会员 30 天，GPT-4 无限使用",
    cover_url: "/images/products/chatgpt-plus.jpg",
    base_price: 135.0,
    category_id: uuid(3),
    stock_available: 23,
    has_specs: true,
    sales_count: 1567,
    sort_order: 6,
    created_at: "2025-01-25T10:00:00Z",
  },
  {
    id: uuid(17),
    title: "YouTube Premium 会员月卡",
    description: "YouTube Premium 会员 30 天，无广告 + 背景播放",
    cover_url: "/images/products/youtube-premium.jpg",
    base_price: 15.9,
    category_id: uuid(2),
    stock_available: 78,
    has_specs: true,
    sales_count: 432,
    sort_order: 7,
    created_at: "2025-01-28T10:00:00Z",
  },
  {
    id: uuid(18),
    title: "Discord Nitro 月卡",
    description: "Discord Nitro 会员 30 天，高清视频 + 服务器加成",
    cover_url: "/images/products/discord-nitro.jpg",
    base_price: 29.9,
    category_id: uuid(4),
    stock_available: 56,
    has_specs: true,
    sales_count: 321,
    sort_order: 8,
    created_at: "2025-01-28T10:00:00Z",
  },
]

// ============================================================
// Product Details (full detail level)
// ============================================================

const mockProductDetails: Record<string, ProductDetail> = {
  [uuid(11)]: {
    ...mockProducts[0],
    detail_md: "使用说明：登录 Steam 客户端 -> 点击右上角用户名 -> 账户明细 -> 充值 Steam 钱包 -> 兑换 Steam 钱包充值码",
    specs: [specSteam50],
    wholesale_enabled: true,
    wholesale_rules: [
      { min_quantity: 5, unit_price: 47.5 },
      { min_quantity: 10, unit_price: 46.5 },
      { min_quantity: 50, unit_price: 45.0 },
    ],
  },
  [uuid(12)]: {
    ...mockProducts[1],
    detail_md: "Netflix Premium 高级会员，支持 4K HDR，最多 4 台设备同时观看。",
    specs: [specNetflixMonth, specNetflixQuarter],
    wholesale_enabled: false,
    wholesale_rules: [],
  },
  [uuid(13)]: {
    ...mockProducts[2],
    detail_md: "Spotify Premium 会员，无广告音乐播放，支持离线下载。",
    specs: [specSpotifyQuarter],
    wholesale_enabled: false,
    wholesale_rules: [],
  },
  [uuid(14)]: {
    ...mockProducts[3],
    detail_md: "Windows 11 Professional 正版激活密钥，永久有效。支持在线激活和电话激活。",
    specs: [specWin11Pro, specWin11Ent],
    wholesale_enabled: true,
    wholesale_rules: [
      { min_quantity: 3, unit_price: 118.0 },
      { min_quantity: 10, unit_price: 108.0 },
    ],
  },
  [uuid(15)]: {
    ...mockProducts[4],
    detail_md: "Microsoft 365 Family，包含 Word/Excel/PowerPoint/Outlook，1TB OneDrive 云存储。",
    specs: [specOffice365],
    wholesale_enabled: false,
    wholesale_rules: [],
  },
  [uuid(16)]: {
    ...mockProducts[5],
    detail_md: "ChatGPT Plus 会员，无限制使用 GPT-4，优先体验新功能。",
    specs: [specChatGPT],
    wholesale_enabled: false,
    wholesale_rules: [],
  },
  [uuid(17)]: {
    ...mockProducts[6],
    detail_md: "YouTube Premium 会员，去除广告，支持后台播放和离线下载。",
    specs: [specYouTube],
    wholesale_enabled: false,
    wholesale_rules: [],
  },
  [uuid(18)]: {
    ...mockProducts[7],
    detail_md: "Discord Nitro 会员，高清视频通话，自定义 Emoji，服务器 Boost。",
    specs: [specDiscordMonth, specDiscordYear],
    wholesale_enabled: false,
    wholesale_rules: [],
  },
}

// ============================================================
// Cart
// ============================================================

export const mockCartItems: CartItem[] = [
  {
    id: uuid(201),
    product_id: uuid(11),
    spec_id: uuid(101),
    product_title: "Steam 50元钱包充值卡",
    spec_name: "50元面额",
    cover_url: "/images/products/steam-50.jpg",
    unit_price: 48.5,
    quantity: 2,
    subtotal: 97.0,
  },
  {
    id: uuid(202),
    product_id: uuid(16),
    spec_id: uuid(108),
    product_title: "ChatGPT Plus 月卡",
    spec_name: "月卡",
    cover_url: "/images/products/chatgpt-plus.jpg",
    unit_price: 135.0,
    quantity: 1,
    subtotal: 135.0,
  },
]

export const mockCart: Cart = {
  items: mockCartItems,
  total_amount: 232.0,
}

// ============================================================
// Orders
// ============================================================

export const mockOrderBriefs: OrderBrief[] = [
  {
    id: uuid(301),
    total_amount: 97.0,
    actual_amount: 97.0,
    status: "DELIVERED",
    order_type: "DIRECT",
    payment_method: "alipay",
    created_at: "2025-02-01T10:00:00Z",
  },
  {
    id: uuid(302),
    total_amount: 135.0,
    actual_amount: 130.0,
    status: "PENDING",
    order_type: "DIRECT",
    payment_method: "wechat",
    created_at: "2025-02-01T14:00:00Z",
  },
  {
    id: uuid(303),
    total_amount: 128.0,
    actual_amount: 128.0,
    status: "EXPIRED",
    order_type: "CART",
    payment_method: "alipay",
    created_at: "2025-01-31T10:00:00Z",
  },
]

export const mockOrderDetails: OrderDetail[] = [
  {
    ...mockOrderBriefs[0],
    email: "user@example.com",
    points_deducted: 0,
    points_discount: 0,
    expires_at: "2025-02-01T10:15:00Z",
    paid_at: "2025-02-01T10:05:00Z",
    delivered_at: "2025-02-01T10:05:01Z",
    items: [
      { id: uuid(401), product_id: uuid(11), product_title: "Steam 50元钱包充值卡", spec_name: "50元面额", unit_price: 48.5, quantity: 2, subtotal: 97.0 },
    ],
  },
  {
    ...mockOrderBriefs[1],
    email: "user@example.com",
    points_deducted: 500,
    points_discount: 5.0,
    expires_at: "2025-02-01T14:15:00Z",
    paid_at: null,
    delivered_at: null,
    items: [
      { id: uuid(402), product_id: uuid(16), product_title: "ChatGPT Plus 月卡", spec_name: "月卡", unit_price: 135.0, quantity: 1, subtotal: 135.0 },
    ],
  },
  {
    ...mockOrderBriefs[2],
    email: "buyer@test.com",
    points_deducted: 0,
    points_discount: 0,
    expires_at: "2025-01-31T10:15:00Z",
    paid_at: null,
    delivered_at: null,
    items: [
      { id: uuid(403), product_id: uuid(14), product_title: "Windows 11 Pro 专业版激活码", spec_name: "专业版", unit_price: 128.0, quantity: 1, subtotal: 128.0 },
    ],
  },
]

// ============================================================
// Deliver Result
// ============================================================

export const mockDeliverResults: DeliverResult[] = [
  {
    order_id: uuid(301),
    status: "DELIVERED",
    groups: [
      {
        product_title: "Steam 50元钱包充值卡",
        spec_name: "50元面额",
        card_keys: [
          "STEAM-XXXX-YYYY-ZZZZ-1111",
          "STEAM-XXXX-YYYY-ZZZZ-2222",
        ],
      },
    ],
  },
]

// ============================================================
// Dashboard Stats
// ============================================================

export const mockDashboardStats: DashboardStats = {
  today_sales: 12580.5,
  month_sales: 458920.0,
  today_orders: 86,
  month_orders: 3456,
  conversion_rate: 68.5,
  today_pv: 4521,
  today_uv: 1230,
  low_stock_products: [
    { product_id: uuid(16), title: "ChatGPT Plus 月卡", available_stock: 23, threshold: 50 },
    { product_id: uuid(15), title: "Office 365 家庭版年卡", available_stock: 34, threshold: 50 },
    { product_id: uuid(18), title: "Discord Nitro 月卡", available_stock: 12, threshold: 50 },
  ],
}

export const mockSalesTrend: SalesTrend[] = Array.from({ length: 14 }, (_, i) => {
  const date = new Date()
  date.setDate(date.getDate() - (13 - i))
  return {
    date: date.toISOString().split("T")[0],
    sales_amount: Math.round(8000 + Math.random() * 8000),
    order_count: Math.round(50 + Math.random() * 60),
  }
})

// ============================================================
// Card Keys
// ============================================================

export const mockCardKeyStock: CardKeyStockSummary[] = [
  { product_id: uuid(11), product_title: "Steam 50元钱包充值卡", spec_id: uuid(101), spec_name: "50元面额", total: 200, available: 89, sold: 108, locked: 0, invalid: 3 },
  { product_id: uuid(14), product_title: "Windows 11 Pro 专业版激活码", spec_id: uuid(105), spec_name: "专业版", total: 300, available: 156, sold: 140, locked: 0, invalid: 4 },
  { product_id: uuid(14), product_title: "Windows 11 Pro 专业版激活码", spec_id: uuid(106), spec_name: "企业版", total: 60, available: 42, sold: 18, locked: 0, invalid: 0 },
  { product_id: uuid(16), product_title: "ChatGPT Plus 月卡", spec_id: uuid(108), spec_name: "月卡", total: 50, available: 23, sold: 26, locked: 0, invalid: 1 },
]

export const mockImportBatches: CardImportBatch[] = [
  { id: uuid(501), product_id: uuid(11), spec_id: uuid(101), imported_by: uuid(901), total_count: 100, success_count: 98, fail_count: 0, fail_detail: null, created_at: "2025-01-28T10:00:00Z" },
  { id: uuid(502), product_id: uuid(14), spec_id: uuid(105), imported_by: uuid(901), total_count: 200, success_count: 200, fail_count: 0, fail_detail: null, created_at: "2025-01-29T10:00:00Z" },
]

export const mockOrderCardKeys: OrderCardKey[] = [
  { card_key_id: uuid(601), content: "STEAM-XXXX-YYYY-ZZZZ-1111", product_title: "Steam 50元钱包充值卡", spec_name: "50元面额", status: "SOLD" },
  { card_key_id: uuid(602), content: "STEAM-XXXX-YYYY-ZZZZ-2222", product_title: "Steam 50元钱包充值卡", spec_name: "50元面额", status: "SOLD" },
]

// ============================================================
// Admin Users
// ============================================================

export const mockAdminUsers: AdminUserItem[] = [
  { id: uuid(701), username: "john_doe", email: "john@example.com", role: "USER", points: 3200, is_deleted: 0, created_at: "2025-01-10T08:00:00Z" },
  { id: uuid(702), username: "alice_w", email: "alice@example.com", role: "USER", points: 1500, is_deleted: 0, created_at: "2025-01-12T08:00:00Z" },
  { id: uuid(703), username: "bob_test", email: "bob@test.com", role: "USER", points: 200, is_deleted: 1, created_at: "2025-01-15T08:00:00Z" },
]

// ============================================================
// Operation Logs
// ============================================================

export const mockOperationLogs: OperationLog[] = [
  { id: uuid(801), user_id: uuid(901), username: "admin", action: "product.create", target_type: "product", target_id: uuid(18), detail: "Created product: Discord Nitro", ip_address: "192.168.1.1", created_at: "2025-02-01T14:00:00Z" },
  { id: uuid(802), user_id: uuid(901), username: "admin", action: "cardkey.import", target_type: "cardkey", target_id: uuid(501), detail: "Imported 100 card keys for Steam", ip_address: "192.168.1.1", created_at: "2025-02-01T13:00:00Z" },
  { id: uuid(803), user_id: uuid(901), username: "admin", action: "order.mark_paid", target_type: "order", target_id: uuid(302), detail: "Manually marked order as paid", ip_address: "192.168.1.1", created_at: "2025-02-01T12:00:00Z" },
  { id: uuid(804), user_id: uuid(901), username: "admin", action: "user.disable", target_type: "user", target_id: uuid(703), detail: "Disabled user: bob_test", ip_address: "192.168.1.1", created_at: "2025-02-01T11:00:00Z" },
]

// ============================================================
// Payment Channels
// ============================================================

export const mockPaymentChannels: PaymentChannelItem[] = [
  { id: uuid(851), channel_code: "wechat", channel_name: "微信支付", provider_type: "epay", config_data: null, is_enabled: true, sort_order: 1, created_at: "2025-01-01T00:00:00Z" },
  { id: uuid(852), channel_code: "alipay", channel_name: "支付宝", provider_type: "epay", config_data: null, is_enabled: true, sort_order: 2, created_at: "2025-01-01T00:00:00Z" },
  { id: uuid(853), channel_code: "usdt_trc20", channel_name: "USDT (TRC20)", provider_type: "usdt", config_data: null, is_enabled: false, sort_order: 3, created_at: "2025-01-01T00:00:00Z" },
]

// ============================================================
// Site Config
// ============================================================

export const mockSiteConfig: SiteConfig = {
  site_name: "Orion Key",
  site_slogan: "Unlock Your AI Potential",
  site_description: "ChatGPT / Claude / Midjourney 等 AI 账号与密钥，自动发货，安全可靠",
  announcement: "新用户注册即送 100 积分！",
  announcement_enabled: false,
  popup_content: "春节特惠活动：全场商品 9 折优惠！",
  popup_enabled: false,
  contact_email: "support@orionkey.com",
  contact_telegram: "@orionkey",
  contact_telegram_group: "https://t.me/+P3w53nfrAhpkMjFh",
  maintenance_enabled: false,
  points_enabled: true,
  points_rate: 100,
  footer_text: "Orion Key - 自动发卡平台",
  github_url: "https://github.com/orion-key/orion-key",
}

export const mockSiteConfigKVs: SiteConfigKV[] = [
  { config_key: "site_name", config_value: "Orion Key", config_group: "basic" },
  { config_key: "site_slogan", config_value: "Unlock Your AI Potential", config_group: "basic" },
  { config_key: "site_description", config_value: "ChatGPT / Claude / Midjourney 等 AI 账号与密钥，自动发货，安全可靠", config_group: "basic" },
  { config_key: "announcement_enabled", config_value: "false", config_group: "announcement" },
  { config_key: "announcement", config_value: "新用户注册即送 100 积分！", config_group: "announcement" },
  { config_key: "popup_enabled", config_value: "false", config_group: "popup" },
  { config_key: "popup_content", config_value: "春节特惠活动：全场商品 9 折优惠！", config_group: "popup" },
  { config_key: "contact_email", config_value: "support@orionkey.com", config_group: "contact" },
  { config_key: "contact_telegram", config_value: "@orionkey", config_group: "contact" },
  { config_key: "contact_telegram_group", config_value: "https://t.me/+P3w53nfrAhpkMjFh", config_group: "contact" },
  { config_key: "maintenance_enabled", config_value: "false", config_group: "maintenance" },
  { config_key: "points_enabled", config_value: "true", config_group: "points" },
  { config_key: "points_rate", config_value: "100", config_group: "points" },
  { config_key: "footer_text", config_value: "Orion Key - 自动发卡平台", config_group: "basic" },
  { config_key: "github_url", config_value: "https://github.com/orion-key/orion-key", config_group: "basic" },
]

// ============================================================
// Risk
// ============================================================

export const mockRiskConfig: RiskConfig = {
  rate_limit_per_second: 10,
  login_attempt_limit: 5,
  max_purchase_per_user: 100,
  max_pending_orders_per_ip: 5,
  max_pending_orders_per_user: 3,
  order_expire_minutes: 15,
}

// ============================================================
// Points Records
// ============================================================

export const mockPointRecords: PointRecord[] = [
  { change_amount: 100, balance_after: 3200, reason: "新用户注册奖励", order_id: null, created_at: "2025-01-10T08:00:00Z" },
  { change_amount: 97, balance_after: 3297, reason: "订单消费奖励", order_id: uuid(301), created_at: "2025-02-01T10:05:00Z" },
  { change_amount: -500, balance_after: 2797, reason: "订单积分抵扣", order_id: uuid(302), created_at: "2025-02-01T14:00:00Z" },
]

// ============================================================
// Admin Orders (extends OrderDetail with admin fields)
// ============================================================

export const mockAdminOrders: AdminOrderItem[] = mockOrderDetails.map((o, i) => ({
  ...o,
  user_id: i < 2 ? uuid(701) : null,
  username: i < 2 ? "john_doe" : null,
  is_risk_flagged: false,
}))

// ============================================================
// Mock User
// ============================================================

export const mockUser: UserProfile = {
  id: uuid(701),
  username: "john_doe",
  email: "john@example.com",
  role: "USER",
  points: 3200,
  created_at: "2025-01-10T08:00:00Z",
}

export const mockAdminUser: UserProfile = {
  id: uuid(901),
  username: "admin",
  email: "admin@orionkey.com",
  role: "ADMIN",
  points: 0,
  created_at: "2025-01-01T00:00:00Z",
}

// ============================================================
// Mock Factory Functions (for withMockFallback)
// ============================================================

export function mockCaptcha(): CaptchaResult {
  return { captcha_id: uuid(9999), captcha_image: "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTIwIiBoZWlnaHQ9IjQwIiB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciPjx0ZXh0IHg9IjEwIiB5PSIzMCIgZm9udC1zaXplPSIyNCIgZmlsbD0iIzMzMyI+QUI4RjwvdGV4dD48L3N2Zz4=" }
}

export function mockLogin(): AuthResult {
  return { token: "mock-jwt-token-" + Date.now(), user: mockUser }
}

export function mockRegister(): AuthResult {
  return { token: "mock-jwt-token-" + Date.now(), user: mockUser }
}

export function mockProductList(params?: { category_id?: string; keyword?: string; page?: number; page_size?: number }): PaginatedData<ProductCard> {
  let filtered = [...mockProducts]
  if (params?.category_id) {
    filtered = filtered.filter(p => p.category_id === params.category_id)
  }
  if (params?.keyword) {
    const kw = params.keyword.toLowerCase()
    filtered = filtered.filter(p => p.title.toLowerCase().includes(kw) || p.description?.toLowerCase().includes(kw))
  }
  const page = params?.page ?? 1
  const pageSize = params?.page_size ?? 20
  const start = (page - 1) * pageSize
  return {
    list: filtered.slice(start, start + pageSize),
    pagination: { page, page_size: pageSize, total: filtered.length },
  }
}

export function mockProductDetail(id: string): ProductDetail | null {
  return mockProductDetails[id] ?? null
}

export function mockCartData(): Cart {
  return { ...mockCart }
}

export function mockOrderList(params?: { status?: string; page?: number; page_size?: number }): PaginatedData<OrderBrief> {
  let filtered = [...mockOrderBriefs]
  if (params?.status) {
    filtered = filtered.filter(o => o.status === params.status)
  }
  const page = params?.page ?? 1
  const pageSize = params?.page_size ?? 20
  return {
    list: filtered.slice((page - 1) * pageSize, page * pageSize),
    pagination: { page, page_size: pageSize, total: filtered.length },
  }
}

export function mockPointsData(params?: { page?: number; page_size?: number }): PointsData {
  const page = params?.page ?? 1
  const pageSize = params?.page_size ?? 20
  return {
    total_points: 2797,
    list: mockPointRecords.slice((page - 1) * pageSize, page * pageSize),
    pagination: { page, page_size: pageSize, total: mockPointRecords.length },
  }
}

export function mockQueryOrders(params: { order_ids?: string[]; emails?: string[] }): OrderBrief[] {
  let results = [...mockOrderBriefs]
  if (params.order_ids?.length) {
    results = results.filter(o => params.order_ids!.includes(o.id))
  }
  if (params.emails?.length) {
    const details = mockOrderDetails.filter(o => params.emails!.includes(o.email))
    results = details.map(d => mockOrderBriefs.find(b => b.id === d.id)!).filter(Boolean)
  }
  return results
}

export function mockDeliver(orderIds: string[]): DeliverResult[] {
  return orderIds.map(id => {
    const existing = mockDeliverResults.find(d => d.order_id === id)
    if (existing) return existing
    const order = mockOrderDetails.find(o => o.id === id)
    if (!order) return { order_id: id, status: "EXPIRED" as const, groups: [] }
    return {
      order_id: id,
      status: "DELIVERED" as const,
      groups: order.items.map(item => ({
        product_title: item.product_title,
        spec_name: item.spec_name,
        card_keys: Array.from({ length: item.quantity }, (_, i) => `KEY-${item.product_title.slice(0, 4).toUpperCase()}-${String(i + 1).padStart(4, "0")}`),
      })),
    }
  })
}

export function mockCreateOrder(email: string, paymentMethod: string): CreateOrderResult {
  const now = new Date().toISOString()
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString()
  const orderId = uuid(Date.now() % 10000)
  const order: OrderDetail = {
    id: orderId,
    total_amount: 48.5,
    actual_amount: 48.5,
    status: "PENDING",
    order_type: "DIRECT",
    payment_method: paymentMethod,
    created_at: now,
    email,
    points_deducted: 0,
    points_discount: 0,
    expires_at: expiresAt,
    paid_at: null,
    delivered_at: null,
    items: [
      { id: uuid(Date.now() % 10000 + 1), product_id: uuid(11), product_title: "Steam 50元钱包充值卡", spec_name: "50元面额", unit_price: 48.5, quantity: 1, subtotal: 48.5 },
    ],
  }
  const payment: PaymentCreateResult = {
    order_id: orderId,
    payment_url: "https://mock-payment.example.com/pay/" + orderId,
    expires_at: expiresAt,
  }
  return { order, payment }
}

export function mockAdminOrderList(params?: { status?: string; page?: number; page_size?: number }): PaginatedData<AdminOrderItem> {
  let filtered = [...mockAdminOrders]
  if (params?.status) {
    filtered = filtered.filter(o => o.status === params.status)
  }
  const page = params?.page ?? 1
  const pageSize = params?.page_size ?? 20
  return {
    list: filtered.slice((page - 1) * pageSize, page * pageSize),
    pagination: { page, page_size: pageSize, total: filtered.length },
  }
}

export function mockAdminUserList(params?: { keyword?: string; page?: number; page_size?: number }): PaginatedData<AdminUserItem> {
  let filtered = [...mockAdminUsers]
  if (params?.keyword) {
    const kw = params.keyword.toLowerCase()
    filtered = filtered.filter(u => u.username.toLowerCase().includes(kw) || u.email.toLowerCase().includes(kw))
  }
  const page = params?.page ?? 1
  const pageSize = params?.page_size ?? 20
  return {
    list: filtered.slice((page - 1) * pageSize, page * pageSize),
    pagination: { page, page_size: pageSize, total: filtered.length },
  }
}

export function mockCardKeyStockList(params?: { product_id?: string }): CardKeyStockSummary[] {
  if (params?.product_id) {
    return mockCardKeyStock.filter(s => s.product_id === params.product_id)
  }
  return [...mockCardKeyStock]
}

export function mockImportBatchList(params?: { page?: number; page_size?: number }): PaginatedData<CardImportBatch> {
  const page = params?.page ?? 1
  const pageSize = params?.page_size ?? 20
  return {
    list: mockImportBatches.slice((page - 1) * pageSize, page * pageSize),
    pagination: { page, page_size: pageSize, total: mockImportBatches.length },
  }
}

export function mockOperationLogList(params?: { page?: number; page_size?: number }): PaginatedData<OperationLog> {
  const page = params?.page ?? 1
  const pageSize = params?.page_size ?? 20
  return {
    list: mockOperationLogs.slice((page - 1) * pageSize, page * pageSize),
    pagination: { page, page_size: pageSize, total: mockOperationLogs.length },
  }
}
