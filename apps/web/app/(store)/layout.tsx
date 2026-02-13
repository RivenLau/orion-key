"use client"

import React from "react"
import { usePathname } from "next/navigation"
import { Wrench, Mail } from "lucide-react"
import { StoreHeader } from "@/components/layout/store-header"
import { StoreFooter } from "@/components/layout/store-footer"
import { useSiteConfig, useAuth, useLocale } from "@/lib/context"

function AnnouncementBar() {
  const { config } = useSiteConfig()

  if (!config?.announcement_enabled || !config.announcement) return null

  return (
    <div className="overflow-hidden bg-primary/10 text-primary">
      <div className="animate-marquee whitespace-nowrap py-1.5 text-xs font-medium sm:text-sm">
        <span className="mx-8">{config.announcement}</span>
        <span className="mx-8">{config.announcement}</span>
      </div>
    </div>
  )
}

function MaintenancePage() {
  const { t } = useLocale()
  const { config } = useSiteConfig()

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4">
      <div className="flex flex-col items-center text-center">
        <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-muted">
          <Wrench className="h-10 w-10 text-muted-foreground" />
        </div>
        <h1 className="mb-3 text-2xl font-bold text-foreground">{t("maintenance.title")}</h1>
        <p className="mb-6 max-w-md text-sm text-muted-foreground">
          {config?.maintenance_message || t("maintenance.description")}
        </p>
        {config?.contact_email && (
          <a
            href={`mailto:${config.contact_email}`}
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            <Mail className="h-4 w-4" />
            {t("maintenance.contactSupport")}
          </a>
        )}
      </div>
    </div>
  )
}

function MaintenanceAdminBanner() {
  const { t } = useLocale()

  return (
    <div className="bg-amber-500/10 text-amber-700 dark:text-amber-400">
      <div className="mx-auto max-w-7xl px-4 py-1.5 text-center text-xs font-medium">
        {t("maintenance.adminBanner")}
      </div>
    </div>
  )
}

/** Routes that are always accessible even in maintenance mode */
const MAINTENANCE_EXEMPT_PATHS = ["/login", "/register"]

export default function StoreLayout({ children }: { children: React.ReactNode }) {
  const { config, isLoading } = useSiteConfig()
  const { user, isLoggedIn } = useAuth()
  const pathname = usePathname()

  const isExempt = MAINTENANCE_EXEMPT_PATHS.includes(pathname)
  const isAdmin = isLoggedIn && user?.role === "ADMIN"
  const isMaintenance = !isLoading && config?.maintenance_enabled

  // Maintenance mode: block non-admin users on non-exempt pages
  if (isMaintenance && !isAdmin && !isExempt) {
    return <MaintenancePage />
  }

  return (
    <div className="flex min-h-screen flex-col">
      {isMaintenance && isAdmin && <MaintenanceAdminBanner />}
      <AnnouncementBar />
      <StoreHeader />
      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 lg:px-6">{children}</main>
      <StoreFooter />
    </div>
  )
}
