"use client"

import { useState, useEffect } from "react"
import { Search, ChevronDown, Eye, Download, ChevronLeft, ChevronRight, X, CheckCircle } from "lucide-react"
import { cn } from "@/lib/utils"
import { useLocale } from "@/lib/context"
import { toast } from "sonner"
import { adminOrderApi, adminCardKeyApi, withMockFallback } from "@/services/api"
import { mockAdminOrderList, mockOrderCardKeys } from "@/lib/mock-data"
import { OrderStatusBadge } from "@/components/shared/order-status-badge"
import { PaymentIcon, getPaymentLabel } from "@/components/shared/payment-icon"
import { Modal } from "@/components/ui/modal"
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
  const [markPaidConfirm, setMarkPaidConfirm] = useState<string | null>(null)

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
      setMarkPaidConfirm(null)
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
          onClick={() => toast.info("导出功能开发中")}
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
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">商品</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">数量</th>
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
                  <td colSpan={10} className="py-12">
                    <div className="flex items-center justify-center">
                      <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                    </div>
                  </td>
                </tr>
              ) : orders.length === 0 ? (
                <tr>
                  <td colSpan={10} className="py-8 text-center text-sm text-muted-foreground">{t("admin.noOrderData")}</td>
                </tr>
              ) : (
                orders.map((order) => (
                  <tr key={order.id} className="border-b border-border/50 last:border-0 hover:bg-muted/20 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5">
                        <span className="font-mono text-sm font-medium text-foreground">
                          {order.id.length > 16 ? `${order.id.slice(0, 8)}...${order.id.slice(-4)}` : order.id}
                        </span>
                        {order.is_risk_flagged && (
                          <span className="rounded-full bg-red-500/10 px-1.5 py-0.5 text-[10px] font-medium text-red-500">{t("admin.riskFlagged")}</span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-sm text-foreground">
                        {order.items?.[0]?.product_title || "-"}
                        {order.items?.[0]?.spec_name && (
                          <span className="text-muted-foreground"> - {order.items[0].spec_name}</span>
                        )}
                        {(order.items?.length ?? 0) > 1 && (
                          <span className="ml-1 text-xs text-muted-foreground">等{order.items.length}件</span>
                        )}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-foreground">
                      {order.items?.reduce((sum, item) => sum + item.quantity, 0) || 0}
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
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center gap-1.5 text-foreground">
                        <PaymentIcon method={order.payment_method} className="h-4 w-4" />
                        {getPaymentLabel(order.payment_method)}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <OrderStatusBadge status={order.status} />
                    </td>
                    <td className="px-4 py-3 text-sm text-muted-foreground whitespace-nowrap">
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
                            onClick={() => setMarkPaidConfirm(order.id)}
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
      <Modal open={showDetail !== null} onClose={() => setShowDetail(null)} className="max-w-lg">
        {showDetail && (
          <>
            <div className="border-b border-border px-6 py-4 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-foreground">{t("admin.orderDetail")}</h2>
                <p className="font-mono text-xs text-muted-foreground">{showDetail.id}</p>
              </div>
              <button
                type="button"
                onClick={() => setShowDetail(null)}
                className="rounded-md p-1 text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="flex flex-col gap-5 p-6">
              <div className="grid grid-cols-2 gap-x-8 gap-y-4">
                <div className="flex flex-col gap-1">
                  <span className="text-xs text-muted-foreground">商品名称</span>
                  <span className="text-sm font-medium text-foreground">
                    {showDetail.items.length > 0
                      ? (showDetail.items[0].product_title + (showDetail.items[0].spec_name ? ` - ${showDetail.items[0].spec_name}` : "") + (showDetail.items.length > 1 ? ` 等${showDetail.items.length}件` : ""))
                      : "-"}
                  </span>
                </div>
                <div className="flex flex-col gap-1">
                  <span className="text-xs text-muted-foreground">支付金额</span>
                  <span className="text-sm font-medium text-foreground">¥{showDetail.actual_amount.toFixed(2)}</span>
                </div>
                <div className="flex flex-col gap-1">
                  <span className="text-xs text-muted-foreground">联系邮箱</span>
                  <span className="text-sm text-foreground">{showDetail.email}</span>
                </div>
                <div className="flex flex-col gap-1">
                  <span className="text-xs text-muted-foreground">支付方式</span>
                  <span className="inline-flex items-center gap-1.5 text-sm text-foreground">
                    <PaymentIcon method={showDetail.payment_method} className="h-4 w-4" />
                    {getPaymentLabel(showDetail.payment_method)}
                  </span>
                </div>
                <div className="flex flex-col gap-1">
                  <span className="text-xs text-muted-foreground">创建时间</span>
                  <span className="text-sm text-foreground">{new Date(showDetail.created_at).toLocaleString()}</span>
                </div>
                <div className="flex flex-col gap-1">
                  <span className="text-xs text-muted-foreground">支付时间</span>
                  <span className="text-sm text-foreground">{showDetail.paid_at ? new Date(showDetail.paid_at).toLocaleString() : "-"}</span>
                </div>
              </div>

              {/* 已发卡密 */}
              {showDetail.status === "DELIVERED" && detailCardKeys.length > 0 && (
                <div>
                  <p className="text-xs text-muted-foreground mb-2">已发卡密</p>
                  <div className="flex flex-col gap-1.5">
                    {detailCardKeys.map((ck) => (
                      <div key={ck.card_key_id} className="rounded-lg border border-border bg-muted/30 px-3 py-2">
                        <code className="text-sm text-foreground">{ck.content}</code>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
            <div className="flex justify-end gap-3 border-t border-border px-6 py-4">
              <button
                type="button"
                className="rounded-lg border border-input bg-transparent px-4 py-2 text-sm font-medium text-foreground hover:bg-accent transition-colors"
                onClick={() => setShowDetail(null)}
              >
                {t("common.close")}
              </button>
              {showDetail.status === "PENDING" && (
                <button
                  type="button"
                  className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
                  onClick={() => setMarkPaidConfirm(showDetail.id)}
                >
                  {t("admin.markPaid")}
                </button>
              )}
            </div>
          </>
        )}
      </Modal>

      {/* Mark Paid Confirmation */}
      <Modal open={markPaidConfirm !== null} onClose={() => setMarkPaidConfirm(null)} className="max-w-sm">
        <div className="flex flex-col items-center gap-4 p-6 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500/10">
            <CheckCircle className="h-6 w-6 text-emerald-600" />
          </div>
          <h3 className="text-base font-semibold text-foreground">{t("admin.markPaidConfirm")}</h3>
          <div className="flex w-full gap-3">
            <button
              type="button"
              className="flex-1 rounded-lg border border-input bg-transparent px-4 py-2 text-sm font-medium text-foreground hover:bg-accent transition-colors"
              onClick={() => setMarkPaidConfirm(null)}
            >
              {t("admin.cancel")}
            </button>
            <button
              type="button"
              className="flex-1 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
              onClick={() => markPaidConfirm && handleMarkPaid(markPaidConfirm)}
            >
              {t("admin.markPaidBtn")}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
