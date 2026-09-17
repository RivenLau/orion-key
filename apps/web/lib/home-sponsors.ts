import { z } from "zod"

export const SPONSOR_ROTATION_DELAY = 6000

export const HOME_ADS_CONFIG_KEY = "homepage_ads"
export const MAX_HOME_ADS = 20

export function isSponsorImage(value: string): boolean {
  return !/\s/.test(value) && /^\/(?:ads|(?:api\/)?uploads)\/[A-Za-z0-9_-]+\.(?:jpe?g|png|webp|gif)$/.test(value)
}

export function isPosterUrl(value: string): boolean {
  if (/[\s\\\u0000-\u001f\u007f]/.test(value)) return false
  const authority = /^https?:\/\/([^/?#]+)/i.exec(value)?.[1]
  if (!authority || authority.includes("@") || /%(?![0-9a-f]{2})/i.test(value)) return false
  try {
    const url = new URL(value)
    return ["http:", "https:"].includes(url.protocol) && !!url.hostname && !url.username && !url.password
  } catch {
    return false
  }
}

const imageUrl = z.string().max(2048).refine(isSponsorImage, "ads.invalidImage")
const optionalImage = z.union([imageUrl, z.literal("")]).optional()
// Keep older destination strings editable; publishing still requires validated absolute URLs.
export const homeAdSettingsEditorSchema = z.object({
  enabled: z.boolean(),
  startFromFirst: z.boolean().default(false),
  intervalSeconds: z.number().int().min(3).max(60),
  items: z.array(z.object({
    id: z.string().regex(/^[A-Za-z0-9_-]{1,64}$/),
    name: z.string().trim().min(1).max(80).optional(),
    sort_order: z.number().int().min(0).max(999999).optional(),
    image: imageUrl,
    darkImage: optionalImage,
    mobileImage: optionalImage,
    darkMobileImage: optionalImage,
    href: z.string().min(1).max(2048),
    // Accept legacy descriptions on read; new saves only use the advertisement name.
    alt: z.object({ zh: z.string().trim().min(1).max(300), en: z.string().trim().min(1).max(300) }).strict().optional(),
    enabled: z.boolean(),
  }).strict()).max(MAX_HOME_ADS),
}).strict().refine((value) => new Set(value.items.map((item) => item.id)).size === value.items.length, "ads.invalidConfig")
  .transform((value) => ({ ...value, items: value.items.map(({ alt, ...item }, index) => ({ ...item, name: item.name ?? item.id, sort_order: item.sort_order ?? index + 1 })) }))

export const homeAdSettingsSchema = homeAdSettingsEditorSchema.superRefine((value, context) => {
  value.items.forEach((item, index) => {
    if (!isPosterUrl(item.href)) context.addIssue({ code: "custom", path: ["items", index, "href"], message: "ads.invalidLink" })
  })
})

export type HomeAdSettings = z.infer<typeof homeAdSettingsSchema>
export type SponsorPoster = HomeAdSettings["items"][number]

export function resolveHomeAds(value: unknown): HomeAdSettings {
  // Missing or invalid settings keep advertisements disabled without bundled assets.
  const result = homeAdSettingsSchema.safeParse(value)
  return result.success ? result.data : { enabled: false, startFromFirst: false, intervalSeconds: 6, items: [] }
}
