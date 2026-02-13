"use client"

import { useEffect } from "react"
import { useRouter, usePathname } from "next/navigation"
import { useAuth } from "./context"

/**
 * Redirects to login if user is not authenticated.
 * Passes current path as redirect param so login page can redirect back.
 */
export function useRequireAuth() {
  const { user, isLoggedIn } = useAuth()
  const router = useRouter()
  const pathname = usePathname()

  useEffect(() => {
    if (!isLoggedIn) {
      router.replace(`/login?redirect=${encodeURIComponent(pathname)}`)
    }
  }, [isLoggedIn, router, pathname])

  return user
}

/**
 * Requires admin role.
 * - Not logged in → redirect to /login?redirect=currentPath
 * - Logged in but not ADMIN → redirect to /
 */
export function useRequireAdmin() {
  const { user, isLoggedIn } = useAuth()
  const router = useRouter()
  const pathname = usePathname()

  useEffect(() => {
    if (!isLoggedIn) {
      router.replace(`/login?redirect=${encodeURIComponent(pathname)}`)
    } else if (user?.role !== "ADMIN") {
      router.replace("/")
    }
  }, [isLoggedIn, user, router, pathname])

  return user
}
