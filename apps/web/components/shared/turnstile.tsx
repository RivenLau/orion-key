"use client"

import { useEffect, useRef, useCallback, useState } from "react"
import { useSiteConfig, useTheme } from "@/lib/context"

const TURNSTILE_SCRIPT_URL = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit"

interface TurnstileProps {
  /** 获取 token 后的回调 */
  onSuccess: (token: string) => void
  /** 验证失败/过期的回调 */
  onError?: () => void
  /** 组件 className */
  className?: string
}

// 全局脚本加载状态
let scriptLoaded = false
let scriptLoading = false
const loadCallbacks: (() => void)[] = []

function loadScript(): Promise<void> {
  if (scriptLoaded) return Promise.resolve()

  return new Promise((resolve) => {
    if (scriptLoading) {
      loadCallbacks.push(resolve)
      return
    }
    scriptLoading = true

    const script = document.createElement("script")
    script.src = TURNSTILE_SCRIPT_URL
    script.async = true
    script.onload = () => {
      scriptLoaded = true
      scriptLoading = false
      resolve()
      loadCallbacks.forEach((cb) => cb())
      loadCallbacks.length = 0
    }
    script.onerror = () => {
      scriptLoading = false
      resolve() // 脚本加载失败也不阻塞
    }
    document.head.appendChild(script)
  })
}

/**
 * Cloudflare Turnstile 组件（Managed 模式）
 *
 * 正常用户完全无感，可疑时自动出现复选框。
 * token 单次有效，提交失败后调用 reset() 获取新 token。
 */
export function Turnstile({ onSuccess, onError, className }: TurnstileProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const widgetIdRef = useRef<string | null>(null)
  const { config } = useSiteConfig()
  const { resolvedTheme } = useTheme()
  // 从后端 /api/site/config 获取 site key（运行时读取，不依赖构建时环境变量）
  // turnstile_site_key 是后端动态注入的字段，不在 SiteConfig 接口定义中
  const siteKey = config ? (config as unknown as Record<string, unknown>).turnstile_site_key as string | undefined : undefined

  useEffect(() => {
    if (!siteKey || !containerRef.current) return

    let mounted = true

    loadScript().then(() => {
      if (!mounted || !containerRef.current) return

      const turnstile = (window as unknown as Record<string, unknown>).turnstile as {
        render: (container: HTMLElement, options: Record<string, unknown>) => string
        reset: (widgetId: string) => void
        remove: (widgetId: string) => void
      } | undefined

      if (!turnstile) return

      // 防止重复渲染
      if (widgetIdRef.current) {
        try { turnstile.remove(widgetIdRef.current) } catch { /* ignore */ }
      }

      widgetIdRef.current = turnstile.render(containerRef.current!, {
        sitekey: siteKey,
        callback: (token: string) => onSuccess(token),
        "error-callback": () => onError?.(),
        "expired-callback": () => onError?.(),
        theme: resolvedTheme === "dark" ? "dark" : "light",
        size: "flexible",
      })
    })

    return () => {
      mounted = false
      if (widgetIdRef.current) {
        try {
          const turnstile = (window as unknown as Record<string, unknown>).turnstile as {
            remove: (widgetId: string) => void
          } | undefined
          turnstile?.remove(widgetIdRef.current)
        } catch { /* ignore */ }
        widgetIdRef.current = null
      }
    }
  }, [siteKey, resolvedTheme, onSuccess, onError])

  // 无 site key 时不渲染（Turnstile 未配置/关闭）
  if (!siteKey) return null

  return <div ref={containerRef} className={className} />
}

/** 重置 Turnstile 组件获取新 token（提交失败后调用） */
export function resetTurnstile() {
  const turnstile = (window as unknown as Record<string, unknown>).turnstile as {
    reset: (widgetId?: string) => void
  } | undefined
  turnstile?.reset()
}

/**
 * Hook: 管理 Turnstile token 状态
 *
 * 使用示例：
 * ```tsx
 * const { turnstileToken, setTurnstileToken, turnstileReady, handleTurnstileReset } = useTurnstile()
 *
 * const handleSubmit = async () => {
 *   try {
 *     setTurnstileHeaders(turnstileToken)
 *     await orderApi.create(data)
 *   } catch (err) {
 *     handleTurnstileReset()
 *   }
 * }
 *
 * return <Turnstile onSuccess={setTurnstileToken} onError={handleTurnstileReset} />
 * ```
 */
export function useTurnstile() {
  const [turnstileToken, setTurnstileToken] = useState<string>("")
  const turnstileReady = !!turnstileToken

  const handleTurnstileReset = useCallback(() => {
    setTurnstileToken("")
    resetTurnstile()
  }, [])

  return { turnstileToken, setTurnstileToken, turnstileReady, handleTurnstileReset }
}
