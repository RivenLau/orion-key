"use client"

import { useState, useEffect, useCallback } from "react"
import { Save, ShieldAlert, ShieldCheck, Eye, ChevronLeft, ChevronRight } from "lucide-react"
import { useLocale } from "@/lib/context"
import { cn } from "@/lib/utils"
import { toast } from "sonner"
import { adminRiskApi, withMockFallback } from "@/services/api"
import { mockRiskConfig, mockAdminOrderList } from "@/lib/mock-data"
import { OrderStatusBadge } from "@/components/shared/order-status-badge"
import type { RiskConfig, AdminOrderItem } from "@/types"

export default function AdminRiskPage() {
  const { t } = useLocale()
  const [tab, setTab] = useState<"config" | "flagged">("config")
  const [config, setConfig] = useState<RiskConfig>({
    rate_limit_per_second: 10,
    login_attempt_limit: 5,
    max_purchase_per_user: 10,
    order_expire_minutes: 15,
    max_pending_orders_per_ip: 3,
    max_pending_orders_per_user: 3,
  })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [flaggedOrders, setFlaggedOrders] = useState<AdminOrderItem[]>([])
  const [flaggedTotal, setFlaggedTotal] = useState(0)
  const [flaggedPage, setFlaggedPage] = useState(1)

  const fetchConfig = useCallback(async () => {
    try {
      const data = await withMockFallback(
        () => adminRiskApi.getConfig(),
        () => ({ ...mockRiskConfig })
      )
      setConfig(data)
    } catch {
      // withMockFallback handles network errors
    } finally {
      setLoading(false)
    }
  }, [])

  const fetchFlaggedOrders = useCallback(async () => {
    try {
      const data = await withMockFallback(
        () => adminRiskApi.getFlaggedOrders({ page: flaggedPage, page_size: 10 }),
        () => mockAdminOrderList({ page: flaggedPage, page_size: 10 })
      )
      setFlaggedOrders(data.list)
      setFlaggedTotal(data.pagination.total)
    } catch {
      setFlaggedOrders([])
    }
  }, [flaggedPage])

  useEffect(() => { fetchConfig() }, [fetchConfig])
  useEffect(() => { if (tab === "flagged") fetchFlaggedOrders() }, [tab, fetchFlaggedOrders])

  const handleSaveConfig = async () => {
    setSaving(true)
    try {
      await withMockFallback(
        () => adminRiskApi.updateConfig(config),
        () => null
      )
      toast.success("风控配置保存成功")
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "保存失败")
    } finally {
      setSaving(false)
    }
  }

  const flaggedTotalPages = Math.ceil(flaggedTotal / 10)

  if (loading) {
    return (
      <div className="flex flex-col gap-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">{t("admin.risk")}</h1>
          <p className="text-sm text-muted-foreground">{t("admin.riskDesc")}</p>
        </div>
        <div className="flex items-center justify-center py-24">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-foreground">{t("admin.risk")}</h1>
        <p className="text-sm text-muted-foreground">{t("admin.riskDesc")}</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-border">
        {[
          { key: "config" as const, label: t("admin.riskConfig"), icon: ShieldCheck },
          { key: "flagged" as const, label: t("admin.flaggedOrders"), icon: ShieldAlert },
        ].map((item) => (
          <button
            key={item.key}
            type="button"
            className={cn(
              "flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors",
              tab === item.key
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            )}
            onClick={() => setTab(item.key)}
          >
            <item.icon className="h-4 w-4" />
            {item.label}
          </button>
        ))}
      </div>

      {/* Risk Config */}
      {tab === "config" && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {/* API Rate Limiting */}
          <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
            <h3 className="mb-4 font-semibold text-foreground">{t("admin.apiRateLimit")}</h3>
            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs text-muted-foreground">{t("admin.ratePerSecond")}</label>
                <input
                  type="number"
                  className="h-9 rounded-lg border border-input bg-background px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                  value={config.rate_limit_per_second}
                  onChange={(e) => setConfig({ ...config, rate_limit_per_second: parseInt(e.target.value) || 0 })}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs text-muted-foreground">{t("admin.loginAttemptLimit")}</label>
                <input
                  type="number"
                  className="h-9 rounded-lg border border-input bg-background px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                  value={config.login_attempt_limit}
                  onChange={(e) => setConfig({ ...config, login_attempt_limit: parseInt(e.target.value) || 0 })}
                />
              </div>
            </div>
          </div>

          {/* Order Limiting */}
          <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
            <h3 className="mb-4 font-semibold text-foreground">{t("admin.orderLimit")}</h3>
            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs text-muted-foreground">{t("admin.maxPurchasePerUser")}</label>
                <input
                  type="number"
                  className="h-9 rounded-lg border border-input bg-background px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                  value={config.max_purchase_per_user}
                  onChange={(e) => setConfig({ ...config, max_purchase_per_user: parseInt(e.target.value) || 0 })}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs text-muted-foreground">{t("admin.orderExpire")}</label>
                <input
                  type="number"
                  className="h-9 rounded-lg border border-input bg-background px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                  value={config.order_expire_minutes}
                  onChange={(e) => setConfig({ ...config, order_expire_minutes: parseInt(e.target.value) || 0 })}
                />
              </div>
            </div>
          </div>

          {/* Pending Order Limits */}
          <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
            <h3 className="mb-4 font-semibold text-foreground">{t("admin.pendingOrderLimit")}</h3>
            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs text-muted-foreground">{t("admin.maxPendingPerIp")}</label>
                <input
                  type="number"
                  className="h-9 rounded-lg border border-input bg-background px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                  value={config.max_pending_orders_per_ip}
                  onChange={(e) => setConfig({ ...config, max_pending_orders_per_ip: parseInt(e.target.value) || 0 })}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs text-muted-foreground">{t("admin.maxPendingPerUser")}</label>
                <input
                  type="number"
                  className="h-9 rounded-lg border border-input bg-background px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                  value={config.max_pending_orders_per_user}
                  onChange={(e) => setConfig({ ...config, max_pending_orders_per_user: parseInt(e.target.value) || 0 })}
                />
              </div>
            </div>
          </div>

          {/* Save button spanning full width */}
          <div className="lg:col-span-2">
            <button
              type="button"
              className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50"
              onClick={handleSaveConfig}
              disabled={saving}
            >
              <Save className="h-4 w-4" />
              {saving ? t("admin.saving") : t("admin.saveRiskConfig")}
            </button>
          </div>
        </div>
      )}

      {/* Flagged Orders */}
      {tab === "flagged" && (
        <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">{t("admin.orderNo")}</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">{t("admin.user")}</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">{t("admin.emailLabel")}</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">{t("admin.amount")}</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">{t("admin.statusLabel")}</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">{t("admin.time")}</th>
                  <th className="px-4 py-3 text-right font-medium text-muted-foreground">{t("admin.actions")}</th>
                </tr>
              </thead>
              <tbody>
                {flaggedOrders.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-sm text-muted-foreground">{t("admin.noFlaggedOrders")}</td>
                  </tr>
                ) : (
                  flaggedOrders.map((order) => (
                    <tr key={order.id} className="border-b border-border/50 last:border-0 hover:bg-muted/20 transition-colors">
                      <td className="px-4 py-3 font-mono text-xs text-foreground">
                        {order.id.length > 16 ? `${order.id.slice(0, 8)}...${order.id.slice(-4)}` : order.id}
                      </td>
                      <td className="px-4 py-3 text-foreground">{order.username || t("admin.guest")}</td>
                      <td className="px-4 py-3 text-muted-foreground">{order.email}</td>
                      <td className="px-4 py-3 font-medium text-foreground">¥{order.actual_amount.toFixed(2)}</td>
                      <td className="px-4 py-3">
                        <OrderStatusBadge status={order.status} />
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">
                        {new Date(order.created_at).toLocaleString()}
                      </td>
                      <td className="px-4 py-3">
                        <button
                          type="button"
                          className="rounded-md p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
                          title="查看详情"
                        >
                          <Eye className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          {flaggedTotalPages > 1 && (
            <div className="flex items-center justify-between border-t border-border px-4 py-3">
              <span className="text-sm text-muted-foreground">{t("admin.totalRecords")} {flaggedTotal} {t("admin.records")}</span>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setFlaggedPage(p => Math.max(1, p - 1))}
                  disabled={flaggedPage === 1}
                  className="flex h-8 w-8 items-center justify-center rounded-md border border-input text-muted-foreground hover:bg-accent disabled:opacity-50"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <span className="px-2 text-sm text-foreground">{flaggedPage} / {flaggedTotalPages}</span>
                <button
                  type="button"
                  onClick={() => setFlaggedPage(p => Math.min(flaggedTotalPages, p + 1))}
                  disabled={flaggedPage === flaggedTotalPages}
                  className="flex h-8 w-8 items-center justify-center rounded-md border border-input text-muted-foreground hover:bg-accent disabled:opacity-50"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
