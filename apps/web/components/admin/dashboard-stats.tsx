"use client"

import React from "react"
import { DollarSign, ShoppingCart, TrendingUp, Eye, AlertTriangle } from "lucide-react"
import { cn } from "@/lib/utils"
import { useLocale } from "@/lib/context"
import type { DashboardStats as DashboardStatsType, LowStockProduct } from "@/types"

interface StatCardProps {
  title: string
  value: string
  icon: React.ElementType
  iconBg: string
}

function StatCard({ title, value, icon: Icon, iconBg }: StatCardProps) {
  return (
    <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
      <div className="flex items-start justify-between">
        <div className="flex flex-col gap-1">
          <span className="text-sm text-muted-foreground">{title}</span>
          <span className="text-2xl font-bold text-foreground">{value}</span>
        </div>
        <div className={cn("flex h-10 w-10 items-center justify-center rounded-lg", iconBg)}>
          <Icon className="h-5 w-5 text-white" />
        </div>
      </div>
    </div>
  )
}

export function DashboardStats({ stats }: { stats: DashboardStatsType }) {
  const { t } = useLocale()
  const statCards: StatCardProps[] = [
    {
      title: t("admin.todaySales"),
      value: `¥${stats.today_sales.toLocaleString()}`,
      icon: DollarSign,
      iconBg: "bg-blue-500",
    },
    {
      title: t("admin.todayOrders"),
      value: String(stats.today_orders),
      icon: ShoppingCart,
      iconBg: "bg-emerald-500",
    },
    {
      title: t("admin.conversionRate"),
      value: `${stats.conversion_rate}%`,
      icon: TrendingUp,
      iconBg: "bg-amber-500",
    },
    {
      title: t("admin.todayPvUv"),
      value: `${stats.today_pv.toLocaleString()} / ${stats.today_uv.toLocaleString()}`,
      icon: Eye,
      iconBg: "bg-violet-500",
    },
  ]

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {statCards.map((stat) => (
        <StatCard key={stat.title} {...stat} />
      ))}
    </div>
  )
}

export function LowStockAlert({ products }: { products: LowStockProduct[] }) {
  const { t } = useLocale()
  if (products.length === 0) return null

  return (
    <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
      <div className="mb-4 flex items-center gap-2">
        <AlertTriangle className="h-4 w-4 text-amber-500" />
        <h3 className="font-semibold text-foreground">{t("admin.lowStockWarning")}</h3>
      </div>
      <div className="flex flex-col gap-3">
        {products.map((item) => (
          <div key={item.product_id} className="flex items-center justify-between rounded-lg bg-amber-500/5 px-3 py-2">
            <span className="text-sm text-foreground">{item.title}</span>
            <span className="rounded-full bg-amber-500/10 px-2.5 py-0.5 text-xs font-medium text-amber-600">
              {t("admin.remaining")} {item.available_stock}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
