"use client"

import { useEffect } from "react"
import { usePathname } from "next/navigation"

export function VisitTracker() {
  const pathname = usePathname()

  useEffect(() => {
    fetch("/api/visit/track", { method: "POST" }).catch(() => {
      // fire-and-forget：采集失败不影响用户体验
    })
  }, [pathname])

  return null
}
