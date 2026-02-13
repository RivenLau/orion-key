"use client"

import { useState, useEffect } from "react"
import { useLocale } from "@/lib/context"
import { DashboardStats, LowStockAlert } from "@/components/admin/dashboard-stats"
import { SalesChart } from "@/components/admin/sales-chart"
import { RecentOrders } from "@/components/admin/recent-orders"
import { adminDashboardApi, adminOrderApi, withMockFallback } from "@/services/api"
import { mockDashboardStats, mockSalesTrend, mockAdminOrderList } from "@/lib/mock-data"
import type { DashboardStats as DashboardStatsType, SalesTrend, AdminOrderItem } from "@/types"

export default function AdminDashboardPage() {
  const { t } = useLocale()
  const [stats, setStats] = useState<DashboardStatsType | null>(null)
  const [trends, setTrends] = useState<SalesTrend[]>([])
  const [recentOrders, setRecentOrders] = useState<AdminOrderItem[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    async function fetchAll() {
      try {
        const [statsData, trendData, orderData] = await Promise.all([
          withMockFallback(
            () => adminDashboardApi.getStats(),
            () => mockDashboardStats
          ),
          withMockFallback(
            () => adminDashboardApi.getSalesTrend({}),
            () => mockSalesTrend
          ),
          withMockFallback(
            () => adminOrderApi.getList({ page: 1, page_size: 5 }),
            () => mockAdminOrderList({ page: 1, page_size: 5 })
          ),
        ])
        if (!cancelled) {
          setStats(statsData)
          setTrends(trendData)
          setRecentOrders(orderData.list)
        }
      } catch {
        // withMockFallback handles network errors; business errors reach here
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    fetchAll()
    return () => { cancelled = true }
  }, [])

  if (loading) {
    return (
      <div className="flex flex-col gap-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">{t("admin.dashboard")}</h1>
          <p className="text-sm text-muted-foreground">{t("admin.welcome")}</p>
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
        <h1 className="text-2xl font-bold text-foreground">仪表盘</h1>
        <p className="text-sm text-muted-foreground">欢迎回来，管理员</p>
      </div>

      {/* Stats Cards */}
      {stats && <DashboardStats stats={stats} />}

      {/* Charts and Alerts */}
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <div className="xl:col-span-2">
          <SalesChart trends={trends} />
        </div>
        {stats && <LowStockAlert products={stats.low_stock_products} />}
      </div>

      {/* Recent Orders */}
      <RecentOrders orders={recentOrders} />
    </div>
  )
}
