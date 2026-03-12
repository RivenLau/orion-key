"use client"

import { useEffect } from "react"
import { useRouter, usePathname } from "next/navigation"
import { useAuth } from "./context"

/**
 * Redirects to login if user is not authenticated.
 * Passes current path as redirect param so login page can redirect back.
 */
export function useRequireAuth() {
  const { user, isLoggedIn, authLoaded } = useAuth()
  const router = useRouter()
  const pathname = usePathname()

  useEffect(() => {
    if (!authLoaded) return
    if (!isLoggedIn) {
      router.replace(`/login?redirect=${encodeURIComponent(pathname)}`)
    }
  }, [authLoaded, isLoggedIn, router, pathname])

  return authLoaded ? user : null
}

/**
 * Requires admin role.
 * - Not logged in → redirect to /login?redirect=currentPath
 * - Logged in but not ADMIN → redirect to /
 */
export function useRequireAdmin() {
  const { user, isLoggedIn, authLoaded } = useAuth()
  const router = useRouter()
  const pathname = usePathname()

  useEffect(() => {
    if (!authLoaded) return
    if (!isLoggedIn) {
      router.replace(`/login?redirect=${encodeURIComponent(pathname)}`)
    } else if (user?.role !== "ADMIN") {
      router.replace("/")
    }
  }, [authLoaded, isLoggedIn, user, router, pathname])

  // 同步判断：未加载完 或 非 ADMIN 均返回 null，阻止子组件渲染
  if (!authLoaded || !isLoggedIn || user?.role !== "ADMIN") return null
  return user
}
