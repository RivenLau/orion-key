"use client"

import { OrderStatusBadge } from "@/components/shared/order-status-badge"
import { useLocale } from "@/lib/context"
import { toast } from "sonner"
import type { AdminOrderItem } from "@/types"

export function RecentOrders({ orders }: { orders: AdminOrderItem[] }) {
  const { t } = useLocale()

  const copyToClipboard = (text: string) => {
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(text).then(
        () => toast.success(t("order.copied")),
        () => fallbackCopy(text)
      )
    } else {
      fallbackCopy(text)
    }
    function fallbackCopy(val: string) {
      const ta = document.createElement("textarea")
      ta.value = val
      ta.style.position = "fixed"
      ta.style.opacity = "0"
      document.body.appendChild(ta)
      ta.select()
      document.execCommand("copy")
      document.body.removeChild(ta)
      toast.success(t("order.copied"))
    }
  }
  return (
    <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
      <h3 className="mb-4 font-semibold text-foreground">{t("admin.recentOrders")}</h3>
      <div className="overflow-x-auto">
        <table className="w-full text-sm table-fixed">
          <colgroup>
            <col className="w-[18%]" />{/* 订单号 */}
            <col className="w-[24%]" />{/* 商品 */}
            <col className="w-[19%]" />{/* 用户 */}
            <col className="w-[10%]" />{/* 金额 */}
            <col className="w-[10%]" />{/* 状态 */}
            <col className="w-[19%]" />{/* 时间 */}
          </colgroup>
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
                  <span
                    className="cursor-pointer underline-offset-4 transition-colors hover:underline hover:text-primary"
                    title={order.id}
                    onClick={() => copyToClipboard(order.id)}
                  >
                    {order.id.length > 20 ? `${order.id.slice(0, 8)}...${order.id.slice(-8)}` : order.id}
                  </span>
                </td>
                <td className="py-3 truncate text-sm text-foreground" title={
                  (order.items?.[0]?.product_title || "-") + (order.items?.[0]?.spec_name ? ` - ${order.items[0].spec_name}` : "") + ((order.items?.length ?? 0) > 1 ? ` 等${order.items.length}件` : "")
                }>
                  {order.items?.[0]?.product_title || "-"}
                  {order.items?.[0]?.spec_name && (
                    <span className="text-muted-foreground"> - {order.items[0].spec_name}</span>
                  )}
                  {(order.items?.length ?? 0) > 1 && (
                    <span className="ml-1 text-xs text-muted-foreground">等{order.items.length}件</span>
                  )}
                </td>
                <td className="py-3 truncate text-foreground" title={order.username || order.email}>{order.username || order.email}</td>
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
