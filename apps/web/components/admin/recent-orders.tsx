"use client"

import { OrderStatusBadge } from "@/components/shared/order-status-badge"
import { useLocale } from "@/lib/context"
import type { AdminOrderItem } from "@/types"

export function RecentOrders({ orders }: { orders: AdminOrderItem[] }) {
  const { t } = useLocale()
  return (
    <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
      <h3 className="mb-4 font-semibold text-foreground">{t("admin.recentOrders")}</h3>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left">
              <th className="pb-3 font-medium text-muted-foreground">{t("admin.orderNo")}</th>
              <th className="pb-3 font-medium text-muted-foreground">{t("admin.product")}</th>
              <th className="pb-3 font-medium text-muted-foreground">{t("admin.user")}</th>
              <th className="pb-3 font-medium text-muted-foreground">{t("admin.amount")}</th>
              <th className="pb-3 font-medium text-muted-foreground">{t("admin.statusLabel")}</th>
              <th className="pb-3 font-medium text-muted-foreground">{t("admin.time")}</th>
            </tr>
          </thead>
          <tbody>
            {orders.map((order) => (
              <tr key={order.id} className="border-b border-border/50 last:border-0">
                <td className="py-3 font-mono text-sm text-foreground">
                  {order.id.length > 20 ? `${order.id.slice(0, 8)}...${order.id.slice(-8)}` : order.id}
                </td>
                <td className="py-3 text-sm text-foreground">
                  {order.items?.[0]?.product_title || "-"}
                  {order.items?.[0]?.spec_name && (
                    <span className="text-muted-foreground"> - {order.items[0].spec_name}</span>
                  )}
                  {(order.items?.length ?? 0) > 1 && (
                    <span className="ml-1 text-xs text-muted-foreground">等{order.items.length}件</span>
                  )}
                </td>
                <td className="py-3 text-foreground">{order.username || order.email}</td>
                <td className="py-3 font-medium text-foreground">¥{order.actual_amount.toFixed(2)}</td>
                <td className="py-3">
                  <OrderStatusBadge status={order.status} />
                </td>
                <td className="py-3 text-muted-foreground">
                  {new Date(order.created_at).toLocaleString()}
                </td>
              </tr>
            ))}
            {orders.length === 0 && (
              <tr>
                <td colSpan={6} className="py-8 text-center text-sm text-muted-foreground">
                  {t("admin.noOrderData")}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
