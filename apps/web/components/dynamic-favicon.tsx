"use client"

import { useEffect } from "react"
import { useSiteConfig } from "@/lib/context"

export function DynamicFavicon() {
  const { config } = useSiteConfig()
  const faviconUrl = config?.favicon_url

  useEffect(() => {
    if (!faviconUrl) return

    let link = document.querySelector<HTMLLinkElement>('link[rel="icon"][data-dynamic]')
    if (!link) {
      link = document.createElement("link")
      link.rel = "icon"
      link.setAttribute("data-dynamic", "true")
      document.head.appendChild(link)
    }
    link.href = faviconUrl

    return () => {
      link?.remove()
    }
  }, [faviconUrl])

  return null
}
