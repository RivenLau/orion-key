"use client"

import { useState } from "react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { Eye, EyeOff, LogIn } from "lucide-react"
import { toast } from "sonner"
import { useLocale, useAuth, useCart } from "@/lib/context"
import { setToken, authApi, withMockFallback, getApiErrorMessage, setTurnstileHeaders } from "@/services/api"
import { mockLogin } from "@/lib/mock-data"
import { Turnstile, useTurnstile } from "@/components/shared/turnstile"

export default function LoginPage() {
  const { t } = useLocale()
  const { setUser } = useAuth()
  const { refreshCart } = useCart()
  const router = useRouter()
  const searchParams = useSearchParams()
  const redirectTo = searchParams.get("redirect")

  const [account, setAccount] = useState("")
  const [password, setPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [rememberMe, setRememberMe] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const { turnstileToken, setTurnstileToken, handleTurnstileReset } = useTurnstile()

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!account.trim() || !password.trim()) return

    setIsLoading(true)
    try {
      setTurnstileHeaders(turnstileToken)
      const result = await withMockFallback(
        () => authApi.login({ account: account.trim(), password }),
        () => mockLogin()
      )

      setToken(result.token)
      setUser(result.user)

      if (rememberMe) {
        localStorage.setItem("rememberMe", "true")
      } else {
        localStorage.removeItem("rememberMe")
      }

      // Refresh cart after login (merges session cart)
      await refreshCart()

      toast.success(t("auth.loginSuccess"))
      router.push(redirectTo || "/")
    } catch (err: unknown) {
      toast.error(getApiErrorMessage(err, t))
      handleTurnstileReset()
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <div className="w-full max-w-sm">
        <div className="rounded-lg border border-border bg-card p-6 shadow-sm">
          <h1 className="mb-6 text-center text-xl font-bold text-card-foreground">
            {t("auth.login")}
          </h1>

          <form onSubmit={handleLogin} className="flex flex-col gap-4">
            {/* Username or Email */}
            <div>
              <label
                htmlFor="account"
                className="mb-1.5 block text-sm font-medium text-foreground"
              >
                {t("auth.usernameOrEmail")}
              </label>
              <input
                id="account"
                type="text"
                value={account}
                onChange={(e) => setAccount(e.target.value)}
                autoComplete="username email"
                className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                required
              />
            </div>

            {/* Password */}
            <div>
              <label
                htmlFor="password"
                className="mb-1.5 block text-sm font-medium text-foreground"
              >
                {t("auth.password")}
              </label>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                  className="h-10 w-full rounded-lg border border-input bg-background px-3 pr-10 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>
            </div>

            {/* Remember Me */}
            <div className="flex items-center">
              <input
                id="rememberMe"
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                className="h-4 w-4 rounded border-input text-primary focus:ring-2 focus:ring-ring focus:ring-offset-0"
              />
              <label
                htmlFor="rememberMe"
                className="ml-2 text-sm text-muted-foreground cursor-pointer select-none"
              >
                {t("auth.rememberMe")}
              </label>
            </div>

            <Turnstile onSuccess={setTurnstileToken} onError={handleTurnstileReset} className="mb-1" />

            {/* Submit */}
            <button
              type="submit"
              disabled={isLoading}
              className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-primary text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:pointer-events-none disabled:opacity-50"
            >
              {isLoading ? (
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary-foreground border-t-transparent" />
              ) : (
                <LogIn className="h-4 w-4" />
              )}
              {t("auth.login")}
            </button>
          </form>

          <p className="mt-4 text-center text-sm text-muted-foreground">
            {t("auth.noAccount")}{" "}
            <Link href="/register" className="font-medium text-primary hover:underline">
              {t("auth.goRegister")}
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
