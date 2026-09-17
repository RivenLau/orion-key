"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import useEmblaCarousel from "embla-carousel-react"
import Autoplay from "embla-carousel-autoplay"
import Fade from "embla-carousel-fade"
import { useLocale } from "@/lib/context"
import { SPONSOR_ROTATION_DELAY, type SponsorPoster } from "@/lib/home-sponsors"
import { cn } from "@/lib/utils"

interface SponsorCarouselProps {
  ads: SponsorPoster[]
  rotationDelay?: number
}

export function SponsorCarousel({ ads, rotationDelay = SPONSOR_ROTATION_DELAY }: SponsorCarouselProps) {
  const { locale, t } = useLocale()
  const [failedIds, setFailedIds] = useState<string[]>([])
  const posters = useMemo(
    () => ads.filter((ad) => ad.enabled && !failedIds.includes(ad.id)),
    [ads, failedIds]
  )
  const [selected, setSelected] = useState(0)
  const containerRef = useRef<HTMLElement>(null)
  const plugins = useMemo(() => [
    Autoplay({
      delay: rotationDelay,
      playOnInit: false,
      stopOnInteraction: false,
      stopOnMouseEnter: false,
      stopOnFocusIn: false,
    }),
    Fade(),
  ], [rotationDelay])
  const [viewportRef, api] = useEmblaCarousel({
    loop: posters.length > 1,
    duration: 30,
    watchDrag: false,
    watchFocus: false,
  }, plugins)

  useEffect(() => {
    // Image requests can fail before hydration attaches React's error handlers.
    const failed = posters.filter((poster) => {
      const slide = Array.from(containerRef.current?.querySelectorAll<HTMLElement>("[data-sponsor-id]") ?? [])
        .find((element) => element.dataset.sponsorId === poster.id)
      return Array.from(slide?.querySelectorAll("img") ?? [])
        .some((image) => image.complete && image.naturalWidth === 0)
    }).map((poster) => poster.id)
    if (failed.length > 0) setFailedIds((ids) => [...new Set([...ids, ...failed])])
  }, [posters])

  useEffect(() => {
    if (!api) return
    const syncSelection = () => setSelected(api.selectedScrollSnap())
    syncSelection()
    api.on("select", syncSelection).on("reInit", syncSelection)
    return () => {
      api.off("select", syncSelection).off("reInit", syncSelection)
    }
  }, [api])

  useEffect(() => {
    const container = containerRef.current
    const autoplay = api?.plugins().autoplay
    if (!container || !api || !autoplay) return

    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)")
    let inView = false
    let pointerOver = window.matchMedia("(hover: hover)").matches && container.matches(":hover")
    let pointerDown = false

    // One gate coordinates every pause reason so leaving hover cannot override focus.
    const syncPlayback = () => {
      const canPlay = posters.length > 1 && inView && !document.hidden &&
        !reducedMotion.matches && !pointerOver && !pointerDown &&
        !container.contains(document.activeElement)
      if (canPlay) {
        if (!autoplay.isPlaying()) autoplay.play()
      } else autoplay.stop()
    }
    const onPointerEnter = (event: PointerEvent) => {
      pointerOver = event.pointerType !== "touch"
      syncPlayback()
    }
    const onPointerLeave = () => { pointerOver = false; syncPlayback() }
    const onPointerDown = () => { pointerDown = true; syncPlayback() }
    const onPointerUp = () => {
      if (!pointerDown) return
      pointerDown = false
      syncPlayback()
    }
    const onFocusOut = () => queueMicrotask(syncPlayback)
    const observer = new IntersectionObserver(([entry]) => {
      inView = entry.isIntersecting
      syncPlayback()
    }, { threshold: 0.25 })

    observer.observe(container)
    container.addEventListener("pointerenter", onPointerEnter)
    container.addEventListener("pointerleave", onPointerLeave)
    container.addEventListener("pointerdown", onPointerDown)
    container.addEventListener("focusin", syncPlayback)
    container.addEventListener("focusout", onFocusOut)
    window.addEventListener("pointerup", onPointerUp)
    window.addEventListener("pointercancel", onPointerUp)
    document.addEventListener("visibilitychange", syncPlayback)
    reducedMotion.addEventListener("change", syncPlayback)
    api.on("reInit", syncPlayback)

    return () => {
      observer.disconnect()
      autoplay.stop()
      container.removeEventListener("pointerenter", onPointerEnter)
      container.removeEventListener("pointerleave", onPointerLeave)
      container.removeEventListener("pointerdown", onPointerDown)
      container.removeEventListener("focusin", syncPlayback)
      container.removeEventListener("focusout", onFocusOut)
      window.removeEventListener("pointerup", onPointerUp)
      window.removeEventListener("pointercancel", onPointerUp)
      document.removeEventListener("visibilitychange", syncPlayback)
      reducedMotion.removeEventListener("change", syncPlayback)
      api.off("reInit", syncPlayback)
    }
  }, [api, posters.length, rotationDelay])

  if (posters.length === 0) return null

  return (
    <aside
      ref={containerRef}
      aria-label={t("home.sponsored")}
      aria-roledescription={t("home.adCarousel")}
      className="relative mt-6 w-[81%] min-w-0 sm:max-w-[356px] lg:absolute lg:bottom-0 lg:right-0 lg:mt-0 lg:aspect-[3/1] lg:h-[min(100%,97.2px)] lg:w-auto xl:h-[min(100%,108px)] 2xl:h-[min(100%,113.4px)]"
    >
      <div className="mb-2 flex items-center gap-2 text-[11px] text-muted-foreground lg:absolute lg:bottom-full lg:left-0 lg:mb-1">
        <span className="rounded border border-border/70 px-1 leading-4">{t("home.sponsored")}</span>
      </div>
      <div ref={viewportRef} className="overflow-hidden rounded-lg border border-border/50 lg:h-full">
        <div className="flex lg:h-full" aria-live="off">
          {posters.map((poster, index) => (
            <div
              key={poster.id}
              className="min-w-0 flex-[0_0_100%]"
              aria-hidden={index !== selected}
              inert={index !== selected}
              data-sponsor-id={poster.id}
            >
              <a
                href={poster.href}
                target="_blank"
                rel="sponsored noopener noreferrer"
                aria-label={`${poster.alt[locale]} ${t("home.adNewTab")}`}
                className="block aspect-[2/1] rounded-lg focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-4 focus-visible:outline-primary sm:aspect-[3/1] lg:aspect-auto lg:h-full"
              >
                <picture className={cn("block h-full", poster.darkImage && "dark:hidden")}>
                  {poster.mobileImage && <source media="(max-width: 639px)" srcSet={poster.mobileImage} />}
                  <img
                    src={poster.image}
                    alt={poster.alt[locale]}
                    width={1920}
                    height={640}
                    draggable={false}
                    referrerPolicy="no-referrer"
                    className="h-full w-full object-cover"
                    onError={() => setFailedIds((ids) => ids.includes(poster.id) ? ids : [...ids, poster.id])}
                  />
                </picture>
                {poster.darkImage && (
                  <picture className="hidden h-full dark:block">
                    {(poster.darkMobileImage || poster.mobileImage) && (
                      <source media="(max-width: 639px)" srcSet={poster.darkMobileImage || poster.mobileImage} />
                    )}
                    <img
                      src={poster.darkImage}
                      alt={poster.alt[locale]}
                      width={1920}
                      height={640}
                      draggable={false}
                      referrerPolicy="no-referrer"
                      className="h-full w-full object-cover"
                      onError={() => setFailedIds((ids) => ids.includes(poster.id) ? ids : [...ids, poster.id])}
                    />
                  </picture>
                )}
              </a>
            </div>
          ))}
        </div>
      </div>
    </aside>
  )
}
