"use client"

import { useState, useEffect, useCallback } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Eye, EyeOff, UserPlus, RefreshCw } from "lucide-react"
import { toast } from "sonner"
import { useLocale } from "@/lib/context"
import { authApi, withMockFallback, getApiErrorMessage, setTurnstileHeaders } from "@/services/api"
import { mockCaptcha } from "@/lib/mock-data"
import { Turnstile, useTurnstile } from "@/components/shared/turnstile"

export default function RegisterPage() {
  const { t } = useLocale()
  const router = useRouter()

  const [form, setForm] = useState({
    username: "",
    email: "",
    password: "",
    captcha: "",
  })
  const [showPassword, setShowPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [captchaId, setCaptchaId] = useState("")
  const [captchaImage, setCaptchaImage] = useState("")
  const [captchaLoading, setCaptchaLoading] = useState(false)
  const { turnstileToken, setTurnstileToken, handleTurnstileReset } = useTurnstile()

  const fetchCaptcha = useCallback(async () => {
    setCaptchaLoading(true)
    try {
      const result = await withMockFallback(
        () => authApi.getCaptcha(),
        () => mockCaptcha()
      )
      setCaptchaId(result.captcha_id)
      setCaptchaImage(result.captcha_image)
    } catch {
      // silent fail — use mock
      const mock = mockCaptcha()
      setCaptchaId(mock.captcha_id)
      setCaptchaImage(mock.captcha_image)
    } finally {
      setCaptchaLoading(false)
    }
  }, [])

  // Fetch captcha on mount
  useEffect(() => {
    fetchCaptcha()
  }, [fetchCaptcha])

  const update = (key: string, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.username.trim() || !form.email.trim() || !form.password.trim() || !form.captcha.trim()) {
      return
    }

    setIsLoading(true)
    try {
      setTurnstileHeaders(turnstileToken)
      await withMockFallback(
        () => authApi.register({
          username: form.username.trim(),
          password: form.password,
          email: form.email.trim(),
          captcha_id: captchaId,
          captcha: form.captcha.trim(),
        }),
        () => {
          const { mockRegister } = require("@/lib/mock-data")
          return mockRegister()
        }
      )
      toast.success(t("auth.registerSuccess"))
      router.push("/login")
    } catch (err: unknown) {
      toast.error(getApiErrorMessage(err, t))
      // Refresh captcha after failed attempt
      fetchCaptcha()
      setForm((prev) => ({ ...prev, captcha: "" }))
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
            {t("auth.register")}
          </h1>

          <form onSubmit={handleRegister} className="flex flex-col gap-4">
            {/* Username */}
            <div>
              <label htmlFor="reg-username" className="mb-1.5 block text-sm font-medium text-foreground">
                {t("auth.username")}
              </label>
              <input
                id="reg-username"
                type="text"
                value={form.username}
                onChange={(e) => update("username", e.target.value)}
                autoComplete="username"
                className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                required
              />
            </div>

            {/* Email */}
            <div>
              <label htmlFor="reg-email" className="mb-1.5 block text-sm font-medium text-foreground">
                {t("auth.email")}
              </label>
              <input
                id="reg-email"
                type="email"
                value={form.email}
                onChange={(e) => update("email", e.target.value)}
                autoComplete="email"
                className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                required
              />
            </div>

            {/* Password */}
            <div>
              <label htmlFor="reg-password" className="mb-1.5 block text-sm font-medium text-foreground">
                {t("auth.password")}
              </label>
              <div className="relative">
                <input
                  id="reg-password"
                  type={showPassword ? "text" : "password"}
                  value={form.password}
                  onChange={(e) => update("password", e.target.value)}
                  autoComplete="new-password"
                  className="h-10 w-full rounded-lg border border-input bg-background px-3 pr-10 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {/* Image Captcha */}
            <div>
              <label htmlFor="reg-captcha" className="mb-1.5 block text-sm font-medium text-foreground">
                {t("auth.imageCode")}
              </label>
              <div className="flex gap-2">
                <input
                  id="reg-captcha"
                  type="text"
                  value={form.captcha}
                  onChange={(e) => update("captcha", e.target.value.toUpperCase())}
                  maxLength={6}
                  placeholder="请输入验证码"
                  className="h-10 flex-1 rounded-lg border border-input bg-background px-3 text-sm uppercase text-foreground tracking-wider focus:outline-none focus:ring-2 focus:ring-ring"
                  required
                />
                <div
                  className="relative flex h-10 w-24 shrink-0 cursor-pointer items-center justify-center rounded-lg border border-border bg-muted overflow-hidden"
                  onClick={fetchCaptcha}
                  title={t("auth.clickToRefresh")}
                >
                  {captchaLoading ? (
                    <RefreshCw className="h-4 w-4 animate-spin text-muted-foreground" />
                  ) : captchaImage ? (
                    <img src={captchaImage} alt="captcha" className="h-full w-full object-contain" />
                  ) : (
                    <span className="select-none text-lg font-bold tracking-wider text-foreground/60">
                      ----
                    </span>
                  )}
                  <RefreshCw className="absolute right-1 top-1 h-3 w-3 text-muted-foreground" />
                </div>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                {t("auth.clickToRefresh")}
              </p>
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
                <UserPlus className="h-4 w-4" />
              )}
              {t("auth.register")}
            </button>
          </form>

          <p className="mt-4 text-center text-sm text-muted-foreground">
            {t("auth.hasAccount")}{" "}
            <Link href="/login" className="font-medium text-primary hover:underline">
              {t("auth.goLogin")}
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
