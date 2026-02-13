"use client"

import { useState, useEffect } from "react"
import { Search, ChevronDown, Eye, Download, ChevronLeft, ChevronRight, X, CheckCircle } from "lucide-react"
import { cn } from "@/lib/utils"
import { useLocale } from "@/lib/context"
import { toast } from "sonner"
import { adminOrderApi, adminCardKeyApi, withMockFallback } from "@/services/api"
import { mockAdminOrderList, mockOrderCardKeys } from "@/lib/mock-data"
import { OrderStatusBadge } from "@/components/shared/order-status-badge"
import type { AdminOrderItem, OrderCardKey } from "@/types"

const ITEMS_PER_PAGE = 10

export default function AdminOrdersPage() {
  const { t } = useLocale()
  const [orders, setOrders] = useState<AdminOrderItem[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState("")
  const [paymentFilter, setPaymentFilter] = useState("")
  const [orderTypeFilter, setOrderTypeFilter] = useState("")
  const [currentPage, setCurrentPage] = useState(1)
  const [showDetail, setShowDetail] = useState<AdminOrderItem | null>(null)
  const [detailCardKeys, setDetailCardKeys] = useState<OrderCardKey[]>([])

  const [debouncedSearch, setDebouncedSearch] = useState("")

  const fetchOrders = async () => {
    setLoading(true)
    try {
      const data = await withMockFallback(
        () => adminOrderApi.getList({
          page: currentPage,
          page_size: ITEMS_PER_PAGE,
          status: statusFilter || undefined,
          order_type: orderTypeFilter || undefined,
          payment_method: paymentFilter || undefined,
          keyword: debouncedSearch || undefined,
        }),
        () => mockAdminOrderList({
          status: statusFilter || undefined,
          page: currentPage,
          page_size: ITEMS_PER_PAGE,
        })
      )
      setOrders(data.list)
      setTotal(data.pagination.total)
    } catch {
      setOrders([])
      setTotal(0)
    } finally {
      setLoading(false)
    }
  }

  // Debounce search input → reset page + commit debounced value
  useEffect(() => {
    if (search === debouncedSearch) return
    const timer = setTimeout(() => {
      setCurrentPage(1)
      setDebouncedSearch(search)
    }, 300)
    return () => clearTimeout(timer)
  }, [search])

  // Single fetch effect for all filter/page/search dependencies
  useEffect(() => { fetchOrders() }, [currentPage, statusFilter, paymentFilter, orderTypeFilter, debouncedSearch])

  const totalPages = Math.ceil(total / ITEMS_PER_PAGE)

  const handleViewDetail = async (order: AdminOrderItem) => {
    setShowDetail(order)
    if (order.status === "DELIVERED") {
      try {
        const keys = await withMockFallback(
          () => adminCardKeyApi.getByOrder(order.id),
          () => [...mockOrderCardKeys]
        )
        setDetailCardKeys(keys)
      } catch {
        setDetailCardKeys([])
      }
    } else {
      setDetailCardKeys([])
    }
  }

  const handleMarkPaid = async (orderId: string) => {
    try {
      await withMockFallback(
        () => adminOrderApi.markPaid(orderId),
        () => null
      )
      toast.success("已标记为已支付")
      setShowDetail(null)
      await fetchOrders()
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "操作失败")
    }
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">{t("admin.orders")}</h1>
          <p className="text-sm text-muted-foreground">{t("admin.ordersDesc")}</p>
        </div>
        <button
          type="button"
          className="flex items-center gap-2 rounded-lg border border-input bg-transparent px-4 py-2.5 text-sm font-medium text-foreground hover:bg-accent transition-colors"
        >
          <Download className="h-4 w-4" />
          导出
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            placeholder={t("admin.searchOrder")}
            className="h-10 w-full rounded-lg border border-input bg-background pl-9 pr-4 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <div className="relative">
          <select
            className="h-10 appearance-none rounded-lg border border-input bg-background pl-3 pr-8 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            value={statusFilter}
            onChange={(e) => { setStatusFilter(e.target.value); setCurrentPage(1) }}
          >
            <option value="">{t("admin.allStatus")}</option>
            <option value="PENDING">待支付</option>
            <option value="PAID">已支付</option>
            <option value="DELIVERED">已发货</option>
            <option value="EXPIRED">已过期</option>
          </select>
          <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        </div>

        <div className="relative">
          <select
            className="h-10 appearance-none rounded-lg border border-input bg-background pl-3 pr-8 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            value={paymentFilter}
            onChange={(e) => { setPaymentFilter(e.target.value); setCurrentPage(1) }}
          >
            <option value="">{t("admin.allPayment")}</option>
            <option value="alipay">支付宝</option>
            <option value="wechat">微信支付</option>
            <option value="usdt_trc20">USDT</option>
          </select>
          <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        </div>

        <div className="relative">
          <select
            className="h-10 appearance-none rounded-lg border border-input bg-background pl-3 pr-8 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            value={orderTypeFilter}
            onChange={(e) => { setOrderTypeFilter(e.target.value); setCurrentPage(1) }}
          >
            <option value="">{t("admin.allOrderType")}</option>
            <option value="DIRECT">{t("admin.directOrder")}</option>
            <option value="CART">{t("admin.cartOrder")}</option>
          </select>
          <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        </div>
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">{t("admin.orderNo")}</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">{t("admin.user")}</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">{t("admin.amount")}</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">{t("admin.orderSource")}</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">{t("admin.paymentMethod")}</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">{t("admin.statusLabel")}</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">{t("admin.time")}</th>
                <th className="px-4 py-3 text-right font-medium text-muted-foreground">{t("admin.actions")}</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={8} className="py-12">
                    <div className="flex items-center justify-center">
                      <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                    </div>
                  </td>
                </tr>
              ) : orders.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-sm text-muted-foreground">{t("admin.noOrderData")}</td>
                </tr>
              ) : (
                orders.map((order) => (
                  <tr key={order.id} className="border-b border-border/50 last:border-0 hover:bg-muted/20 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5">
                        <span className="font-mono text-xs font-medium text-foreground">
                          {order.id.length > 16 ? `${order.id.slice(0, 8)}...${order.id.slice(-4)}` : order.id}
                        </span>
                        {order.is_risk_flagged && (
                          <span className="rounded-full bg-red-500/10 px-1.5 py-0.5 text-[10px] font-medium text-red-500">{t("admin.riskFlagged")}</span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-col gap-0.5">
                        <span className="text-xs text-foreground">{order.username || t("admin.guest")}</span>
                        <span className="text-xs text-muted-foreground">{order.email}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="font-medium text-foreground">¥{order.actual_amount.toFixed(2)}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={cn(
                        "rounded-full px-2.5 py-0.5 text-xs font-medium",
                        order.order_type === "CART"
                          ? "bg-purple-500/10 text-purple-600"
                          : "bg-blue-500/10 text-blue-600"
                      )}>
                        {order.order_type === "CART" ? t("admin.cartOrder") : t("admin.directOrder")}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{order.payment_method}</td>
                    <td className="px-4 py-3">
                      <OrderStatusBadge status={order.status} />
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">
                      {new Date(order.created_at).toLocaleString()}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          type="button"
                          onClick={() => handleViewDetail(order)}
                          className="rounded-md p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
                          title={t("admin.viewDetail")}
                        >
                          <Eye className="h-4 w-4" />
                        </button>
                        {order.status === "PENDING" && (
                          <button
                            type="button"
                            onClick={() => handleMarkPaid(order.id)}
                            className="rounded-md p-1.5 text-muted-foreground hover:bg-emerald-500/10 hover:text-emerald-600 transition-colors"
                            title={t("admin.markPaid")}
                          >
                            <CheckCircle className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            {t("common.page")} {currentPage} / {totalPages}{t("admin.totalRecords")} {total} {t("admin.records")}
          </p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="flex h-9 w-9 items-center justify-center rounded-lg border border-input bg-transparent text-muted-foreground hover:bg-accent hover:text-foreground transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            {Array.from({ length: totalPages }, (_, i) => i + 1)
              .filter(page => page === 1 || page === totalPages || Math.abs(page - currentPage) <= 1)
              .map((page, index, array) => (
                <div key={page} className="flex items-center gap-1">
                  {index > 0 && array[index - 1] !== page - 1 && (
                    <span className="px-2 text-muted-foreground">...</span>
                  )}
                  <button
                    type="button"
                    onClick={() => setCurrentPage(page)}
                    className={cn(
                      "flex h-9 w-9 items-center justify-center rounded-lg text-sm font-medium transition-colors",
                      currentPage === page
                        ? "bg-primary text-primary-foreground"
                        : "border border-input bg-transparent text-foreground hover:bg-accent"
                    )}
                  >
                    {page}
                  </button>
                </div>
              ))}
            <button
              type="button"
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="flex h-9 w-9 items-center justify-center rounded-lg border border-input bg-transparent text-muted-foreground hover:bg-accent hover:text-foreground transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {/* Detail Modal */}
      {showDetail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setShowDetail(null)}>
          <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-xl bg-card border border-border shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="border-b border-border px-6 py-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-foreground">{t("admin.orderDetail")}</h2>
              <button
                type="button"
                onClick={() => setShowDetail(null)}
                className="rounded-md p-1 text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="flex flex-col gap-6 p-6">
              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-1">
                  <span className="text-xs text-muted-foreground">{t("admin.orderNo")}</span>
                  <span className="font-mono text-sm font-medium text-foreground">{showDetail.id}</span>
                </div>
                <div className="flex flex-col gap-1">
                  <span className="text-xs text-muted-foreground">{t("admin.statusLabel")}</span>
                  <OrderStatusBadge status={showDetail.status} />
                </div>
                <div className="flex flex-col gap-1">
                  <span className="text-xs text-muted-foreground">{t("admin.amount")}</span>
                  <span className="text-sm font-medium text-foreground">¥{showDetail.actual_amount.toFixed(2)}</span>
                </div>
                <div className="flex flex-col gap-1">
                  <span className="text-xs text-muted-foreground">{t("admin.paymentMethod")}</span>
                  <span className="text-sm text-foreground">{showDetail.payment_method}</span>
                </div>
                <div className="flex flex-col gap-1">
                  <span className="text-xs text-muted-foreground">{t("admin.time")}</span>
                  <span className="text-sm text-foreground">{new Date(showDetail.created_at).toLocaleString()}</span>
                </div>
                <div className="flex flex-col gap-1">
                  <span className="text-xs text-muted-foreground">{t("admin.orderSource")}</span>
                  <span className="text-sm text-foreground">
                    {showDetail.order_type === "CART" ? t("admin.cartOrder") : t("admin.directOrder")}
                  </span>
                </div>
                <div className="flex flex-col gap-1">
                  <span className="text-xs text-muted-foreground">{t("admin.user")}</span>
                  <span className="text-sm text-foreground">{showDetail.username || t("admin.guest")}</span>
                </div>
                <div className="flex flex-col gap-1">
                  <span className="text-xs text-muted-foreground">{t("admin.emailLabel")}</span>
                  <span className="text-sm text-foreground">{showDetail.email}</span>
                </div>
              </div>

              {/* Order items */}
              {showDetail.items.length > 0 && (
                <div className="rounded-lg border border-border p-4">
                  <p className="text-sm font-medium text-foreground mb-2">{t("admin.orderItems")}</p>
                  <div className="flex flex-col gap-2">
                    {showDetail.items.map((item) => (
                      <div key={item.id} className="flex items-center justify-between rounded-lg bg-muted/30 px-3 py-2">
                        <div>
                          <span className="text-sm text-foreground">{item.product_title}</span>
                          {item.spec_name && <span className="text-xs text-muted-foreground ml-2">({item.spec_name})</span>}
                        </div>
                        <span className="text-sm text-foreground">×{item.quantity} = ¥{item.subtotal.toFixed(2)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Card keys for delivered orders */}
              {showDetail.status === "DELIVERED" && detailCardKeys.length > 0 && (
                <div className="rounded-lg border border-border bg-muted/30 p-4">
                  <p className="text-sm font-medium text-foreground mb-2">{t("admin.cardKeysDetail")}</p>
                  <div className="flex flex-col gap-2">
                    {detailCardKeys.map((ck) => (
                      <div key={ck.card_key_id} className="rounded bg-background p-3">
                        <code className="text-xs text-foreground">{ck.content}</code>
                        <span className="ml-2 text-xs text-muted-foreground">({ck.product_title})</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
            <div className="flex justify-end gap-3 border-t border-border px-6 py-4">
              {showDetail.status === "PENDING" && (
                <button
                  type="button"
                  className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 transition-colors"
                  onClick={() => handleMarkPaid(showDetail.id)}
                >
                  {t("admin.markPaid")}
                </button>
              )}
              <button
                type="button"
                className="rounded-lg border border-input bg-transparent px-4 py-2 text-sm font-medium text-foreground hover:bg-accent transition-colors"
                onClick={() => setShowDetail(null)}
              >
                {t("common.close")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
