"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { Package, ExternalLink } from "lucide-react"
import { PaymentIcon, getPaymentLabel } from "@/components/shared/payment-icon"
import { useLocale } from "@/lib/context"
import { useRequireAuth } from "@/lib/hooks"
import { userApi, withMockFallback } from "@/services/api"
import { mockOrderList } from "@/lib/mock-data"
import { OrderStatusBadge } from "@/components/shared/order-status-badge"
import type { OrderBrief, OrderStatus } from "@/types"
import type { TranslationKey } from "@/lib/i18n"
import { cn } from "@/lib/utils"

const STATUS_FILTERS: (OrderStatus | "ALL")[] = ["ALL", "PENDING", "PAID", "DELIVERED", "EXPIRED"]

export default function MyOrdersPage() {
  const { t } = useLocale()
  const user = useRequireAuth()
  const [statusFilter, setStatusFilter] = useState<OrderStatus | "ALL">("ALL")
  const [orders, setOrders] = useState<OrderBrief[]>([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const pageSize = 20

  useEffect(() => {
    if (!user) return
    let cancelled = false
    async function fetchOrders() {
      setLoading(true)
      try {
        const params: { page: number; page_size: number; status?: string } = { page, page_size: pageSize }
        if (statusFilter !== "ALL") params.status = statusFilter
        const data = await withMockFallback(
          () => userApi.getOrders(params),
          () => mockOrderList(params)
        )
        if (!cancelled) {
          setOrders(data.list)
          setTotal(data.pagination.total)
        }
      } catch {
        if (!cancelled) {
          setOrders([])
          setTotal(0)
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    fetchOrders()
    return () => { cancelled = true }
  }, [user, statusFilter, page])

  const statusKeys: Record<OrderStatus, TranslationKey> = {
    PENDING: "status.PENDING",
    PAID: "status.PAID",
    DELIVERED: "status.DELIVERED",
    EXPIRED: "status.EXPIRED",
  }

  const getFilterLabel = (s: OrderStatus | "ALL") => {
    if (s === "ALL") return t("myOrders.all")
    return t(statusKeys[s])
  }

  if (!user) return null

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="mb-6 text-xl font-bold text-foreground">{t("myOrders.title")}</h1>

      {/* Status Filter */}
      <div className="mb-6 flex flex-wrap gap-2">
        {STATUS_FILTERS.map((s) => (
          <button
            key={s}
            onClick={() => { setStatusFilter(s); setPage(1) }}
            className={cn(
              "rounded-full px-3 py-1.5 text-sm font-medium transition-colors",
              statusFilter === s
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground hover:bg-accent"
            )}
          >
            {getFilterLabel(s)}
          </button>
        ))}
      </div>

      {/* Orders List */}
      {loading ? (
        <div className="flex items-center justify-center py-24">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        </div>
      ) : orders.length > 0 ? (
        <div className="flex flex-col gap-3">
          {orders.map((order) => (
            <div
              key={order.id}
              className="rounded-lg border border-border bg-card p-4 transition-colors hover:border-primary/20"
            >
              {/* Order Header */}
              <div className="mb-3 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="font-mono text-xs font-medium text-card-foreground">
                    {order.id.length > 20 ? `${order.id.slice(0, 8)}...${order.id.slice(-8)}` : order.id}
                  </span>
                  <OrderStatusBadge status={order.status} />
                </div>
                <span className="text-xs text-muted-foreground">
                  {new Date(order.created_at).toLocaleString()}
                </span>
              </div>

              {/* Order Summary */}
              <div className="mb-3 flex items-center gap-3 text-sm text-muted-foreground">
                <span>{order.order_type === "CART" ? t("myOrders.cartOrder") : t("myOrders.directOrder")}</span>
                <span>·</span>
                <span className="inline-flex items-center gap-1">
                  <PaymentIcon method={order.payment_method} className="h-4 w-4" />
                  {getPaymentLabel(order.payment_method, t)}
                </span>
              </div>

              {/* Footer */}
              <div className="flex items-center justify-between border-t border-border pt-3">
                <span className="text-sm text-muted-foreground">
                  {t("order.amount")}:{" "}
                  <span className="font-semibold text-foreground">
                    {"\u00A5"}{order.actual_amount.toFixed(2)}
                  </span>
                </span>
                <div className="flex gap-2">
                  {order.status === "PENDING" && order.payment_method && !order.payment_method.startsWith("usdt_") && (
                    <Link
                      href={`/pay/${order.id}?method=${order.payment_method}`}
                      className="inline-flex h-8 items-center gap-1 rounded-md bg-primary px-3 text-xs font-medium text-primary-foreground hover:bg-primary/90"
                    >
                      {t("payment.continuePay")}
                    </Link>
                  )}
                  {order.status === "DELIVERED" && (
                    <Link
                      href={`/order/query?orderId=${order.id}`}
                      className="inline-flex h-8 items-center gap-1 rounded-md border border-border px-3 text-xs font-medium text-foreground hover:bg-accent"
                    >
                      <ExternalLink className="h-3 w-3" />
                      {t("order.cardKeys")}
                    </Link>
                  )}
                </div>
              </div>
            </div>
          ))}

          {/* Pagination */}
          {total > pageSize && (
            <div className="flex justify-center gap-2 pt-4">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="rounded-md border border-border px-3 py-1.5 text-sm text-foreground disabled:opacity-50"
              >
                {t("common.prev")}
              </button>
              <span className="flex items-center px-3 text-sm text-muted-foreground">
                {page} / {Math.ceil(total / pageSize)}
              </span>
              <button
                onClick={() => setPage(p => Math.min(Math.ceil(total / pageSize), p + 1))}
                disabled={page >= Math.ceil(total / pageSize)}
                className="rounded-md border border-border px-3 py-1.5 text-sm text-foreground disabled:opacity-50"
              >
                {t("common.next")}
              </button>
            </div>
          )}
        </div>
      ) : (
        <div className="flex flex-col items-center py-16">
          <Package className="mb-3 h-10 w-10 text-muted-foreground/30" />
          <p className="text-sm text-muted-foreground">{t("common.noData")}</p>
        </div>
      )}
    </div>
  )
}
