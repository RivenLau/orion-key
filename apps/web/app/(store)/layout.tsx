import React from "react"
import { getSiteConfig } from "@/services/api-server"
import { StoreShell } from "./store-shell"

export default async function StoreLayout({ children }: { children: React.ReactNode }) {
  const config = await getSiteConfig().catch(() => null)

  return (
    <StoreShell siteName={config?.site_name || ""}>
      {children}
    </StoreShell>
  )
}
