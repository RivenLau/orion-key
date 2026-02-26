"use client"

import React from "react"
import { AdminSidebar } from "@/components/layout/admin-sidebar"
import { useRequireAdmin } from "@/lib/hooks"
import { useSiteConfig } from "@/lib/context"

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = useRequireAdmin()
  const { isLoading } = useSiteConfig()

  if (!user || isLoading) return null

  return (
    <div className="min-h-screen bg-background">
      <AdminSidebar />
      <main className="md:ml-60 min-h-screen">
        <div className="p-6 lg:p-8">{children}</div>
      </main>
    </div>
  )
}
