"use client"

/*
 * Adapted from Magic UI Magic Card (gradient mode): https://magicui.design/r/magic-card.json
 * MIT License — Copyright (c) Magic UI
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 */

import { useCallback, useEffect, useRef, type PointerEvent, type ReactNode } from "react"
import { motion, useMotionTemplate, useMotionValue } from "motion/react"
import { cn } from "@/lib/utils"

// Keep the spotlight inside the poster, without changing its geometry or links.
export function MagicCard({ children, className }: { children: ReactNode; className?: string }) {
  const interaction = useRef<MediaQueryList | null>(null)
  const mouseX = useMotionValue(-180)
  const mouseY = useMotionValue(-180)
  const opacity = useMotionValue(0)
  const reset = useCallback(() => {
    mouseX.set(-180)
    mouseY.set(-180)
    opacity.set(0)
  }, [mouseX, mouseY, opacity])

  useEffect(() => {
    const query = window.matchMedia("(hover: hover) and (pointer: fine) and (prefers-reduced-motion: no-preference)")
    interaction.current = query
    const onVisibilityChange = () => { if (document.hidden) reset() }
    query.addEventListener("change", reset)
    window.addEventListener("blur", reset)
    document.addEventListener("visibilitychange", onVisibilityChange)
    return () => {
      interaction.current = null
      query.removeEventListener("change", reset)
      window.removeEventListener("blur", reset)
      document.removeEventListener("visibilitychange", onVisibilityChange)
    }
  }, [reset])

  const handlePointerMove = (event: PointerEvent<HTMLDivElement>) => {
    if (!interaction.current?.matches || event.pointerType === "touch") {
      reset()
      return
    }
    const rect = event.currentTarget.getBoundingClientRect()
    mouseX.set(event.clientX - rect.left)
    mouseY.set(event.clientY - rect.top)
    opacity.set(1)
  }

  const background = useMotionTemplate`linear-gradient(hsl(var(--card)), hsl(var(--card))) padding-box,
    radial-gradient(180px circle at ${mouseX}px ${mouseY}px,
      hsl(var(--primary) / 0.85), hsl(var(--primary) / 0.3) 45%, hsl(var(--border) / 0.5) 100%) border-box`
  const spotlight = useMotionTemplate`radial-gradient(180px circle at ${mouseX}px ${mouseY}px,
    rgb(255 255 255 / var(--magic-glow)), hsl(var(--primary) / 0.04) 45%, transparent 100%)`

  return (
    <motion.div
      className={cn("relative isolate overflow-hidden rounded-lg border border-transparent [--magic-glow:0.08] dark:[--magic-glow:0.14]", className)}
      style={{ background }}
      onPointerEnter={handlePointerMove}
      onPointerMove={handlePointerMove}
      onPointerLeave={reset}
      onPointerCancel={reset}
    >
      <div className="relative z-10 h-full">{children}</div>
      {/* Posters are opaque, so the low-opacity light sits above the image. */}
      <motion.div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 z-20 rounded-[inherit] transition-opacity duration-200 motion-reduce:hidden"
        style={{ background: spotlight, opacity }}
      />
    </motion.div>
  )
}
