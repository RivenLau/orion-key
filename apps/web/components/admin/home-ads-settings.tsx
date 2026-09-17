"use client"

import { useRef, useState } from "react"
import { Edit, ImagePlus, Loader2, Plus, Save, Trash2, X } from "lucide-react"
import { toast } from "sonner"
import { ApiError, adminConfigApi, adminProductApi } from "@/services/api"
import { Modal } from "@/components/ui/modal"
import { Switch } from "@/components/ui/switch"
import { Pagination } from "@/components/shared/pagination"
import { useLocale } from "@/lib/context"
import { HOME_ADS_CONFIG_KEY, MAX_HOME_ADS, homeAdSettingsSchema, isSponsorImage, resolveHomeAds, type HomeAdSettings } from "@/lib/home-sponsors"

const inputClass = "w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
const buttonClass = "inline-flex items-center justify-center gap-1.5 rounded-lg border border-input px-3 py-2 text-sm transition-colors hover:bg-accent disabled:cursor-not-allowed disabled:opacity-50"
const primaryClass = "inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
const imageFields = ["image", "darkImage", "mobileImage", "darkMobileImage"] as const
type ImageField = typeof imageFields[number]
type Advertisement = HomeAdSettings["items"][number]

function readSettings(value?: string): HomeAdSettings | null {
  try {
    return value === undefined ? resolveHomeAds(undefined) : homeAdSettingsSchema.parse(JSON.parse(value))
  } catch { return null }
}

export function HomeAdsSettings({ initialValue, onSaved, onReload }: { initialValue?: string; onSaved: (value: string) => void; onReload: () => void }) {
  const { t } = useLocale()
  const [initial] = useState(() => readSettings(initialValue))
  const [published, setPublished] = useState(initial ?? resolveHomeAds(null))
  const [expected, setExpected] = useState(initialValue ?? "")
  const [options, setOptions] = useState(() => ({ enabled: published.enabled, startFromFirst: published.startFromFirst, intervalSeconds: published.intervalSeconds }))
  const [form, setForm] = useState<Advertisement | null>(null)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [page, setPage] = useState(1)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState<ImageField | null>(null)
  const [needsReload, setNeedsReload] = useState<"ads.conflict" | "ads.unverified" | null>(null)
  const pending = useRef(false)
  const busy = saving || uploading !== null
  const ordered = [...published.items].sort((a, b) => a.sort_order - b.sort_order)

  const persist = async (next: HomeAdSettings) => {
    if (pending.current || needsReload) return false
    const parsed = homeAdSettingsSchema.safeParse(next)
    if (!parsed.success) {
      toast.error(t(parsed.error.issues[0].path[0] === "intervalSeconds" ? "ads.invalidInterval" : "ads.invalidFields"))
      return false
    }
    pending.current = true
    setSaving(true)
    try {
      const value = JSON.stringify(parsed.data)
      await adminConfigApi.update({ configs: [{ config_key: HOME_ADS_CONFIG_KEY, config_value: value, expected_value: expected }] })
      const stored = (await adminConfigApi.get()).find((item) => item.config_key === HOME_ADS_CONFIG_KEY)
      const verified = stored && readSettings(stored.config_value)
      if (!verified || JSON.stringify(verified) !== value) {
        setNeedsReload("ads.unverified")
        toast.error(t("ads.unverified"))
        return false
      }
      setPublished(verified)
      setExpected(stored.config_value)
      setPage((current) => Math.min(current, Math.max(1, Math.ceil(verified.items.length / 10))))
      onSaved(stored.config_value)
      toast.success(t("ads.saved"))
      return true
    } catch (error) {
      const conflict = error instanceof ApiError && error.code === 70006
      if (conflict) setNeedsReload("ads.conflict")
      toast.error(t(conflict ? "ads.conflict" : "ads.saveError"))
      return false
    } finally {
      pending.current = false
      setSaving(false)
    }
  }

  const upload = async (file: File, field: ImageField) => {
    if (!form || pending.current) return
    if (!["image/jpeg", "image/png", "image/webp", "image/gif"].includes(file.type) || !/\.(jpe?g|png|webp|gif)$/i.test(file.name) || !file.size || file.size > 10 * 1024 * 1024) {
      toast.error(t("ads.uploadError"))
      return
    }
    pending.current = true
    setUploading(field)
    try {
      // Decode only server-validated uploads, never arbitrary local file contents.
      const result = await adminProductApi.uploadImage(file)
      if (!isSponsorImage(result.url)) throw new Error("Unsupported image path")
      setForm((current) => current && ({ ...current, [field]: result.url }))
      const ratio = field.toLowerCase().includes("mobile") ? 2 : 3
      if (result.width && result.height && Math.abs(result.width / result.height - ratio) >= 0.05) toast.warning(t("ads.ratioWarning"))
      else toast.success(t("ads.uploaded"))
    } catch { toast.error(t("ads.uploadError")) }
    finally { pending.current = false; setUploading(null) }
  }

  const closeForm = () => { if (!pending.current) setForm(null) }
  const saveForm = async () => {
    if (!form) return
    if (!form.name?.trim()) { toast.error(t("ads.invalidFields")); return }
    const items = published.items.some((item) => item.id === form.id)
      ? published.items.map((item) => item.id === form.id ? form : item) : [...published.items, form]
    if (await persist({ ...published, items })) setForm(null)
  }

  if (!initial || needsReload) return <div role="alert" className="rounded-xl border border-border bg-card p-6 text-sm">
    <p>{t(needsReload ?? "ads.invalidConfig")}</p>
    <button type="button" onClick={onReload} className="mt-3 text-primary underline">{t("ads.reload")}</button>
  </div>

  const imageInput = (field: ImageField) => (
    <div key={field} className="min-w-0 rounded-lg border border-border p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-sm font-medium">{t(`ads.${field}`)}</span>
        <label className={buttonClass + " cursor-pointer"}>
          {uploading === field ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImagePlus className="h-4 w-4" />}{t("ads.upload")}
          <input type="file" aria-label={`${t("ads.upload")} ${t(`ads.${field}`)}`} accept=".jpg,.jpeg,.png,.webp,.gif" className="sr-only" disabled={busy} onChange={(event) => {
            const file = event.currentTarget.files?.[0]
            event.currentTarget.value = ""
            if (file) void upload(file, field)
          }} />
        </label>
      </div>
      {form?.[field] && <>
        <img src={form[field]} alt={t("ads.preview")} referrerPolicy="no-referrer" className="mt-3 max-h-40 w-full rounded-md bg-muted object-contain" />
        {field !== "image" && <button type="button" className="mt-2 text-xs text-destructive" onClick={() => setForm({ ...form, [field]: "" })}>{t("ads.removeImage")}</button>}
      </>}
    </div>
  )

  return <div className="flex flex-col gap-6">
    <fieldset disabled={busy} className="rounded-xl border border-border bg-card p-6 shadow-sm">
      <div className="flex max-w-xl flex-col gap-5">
        <h2 className="font-semibold">{t("ads.title")}</h2>
        <label className="flex items-center justify-between gap-4 text-sm font-medium">{t("ads.enabled")}<Switch disabled={busy} checked={options.enabled} onCheckedChange={(enabled) => setOptions({ ...options, enabled })} /></label>
        <div><label className="flex items-center justify-between gap-4 text-sm font-medium">{t("ads.startFirst")}<Switch disabled={busy} checked={options.startFromFirst} onCheckedChange={(startFromFirst) => setOptions({ ...options, startFromFirst })} /></label><p className="mt-2 text-xs leading-relaxed text-muted-foreground">{t("ads.startHint")}</p></div>
        <label className="flex flex-col gap-1.5 text-sm font-medium">{t("ads.interval")}<input className={inputClass} type="number" min={3} max={60} step={1} value={Number.isNaN(options.intervalSeconds) ? "" : options.intervalSeconds} onChange={(e) => setOptions({ ...options, intervalSeconds: e.target.valueAsNumber })} /><span className="text-xs font-normal text-muted-foreground">{t("ads.intervalHint")}</span></label>
        <button type="button" className={primaryClass + " self-start"} onClick={() => void persist({ ...published, ...options })}><Save className="h-4 w-4" />{t(saving ? "admin.saving" : "admin.saveSettings")}</button>
      </div>
    </fieldset>
    <div className="flex flex-wrap items-center justify-between gap-3">
      <h2 className="font-semibold">{t("ads.list")} <span className="text-sm font-normal text-muted-foreground">{published.items.length} / {MAX_HOME_ADS}</span></h2>
      <button type="button" className={primaryClass} disabled={busy || published.items.length >= MAX_HOME_ADS} onClick={() => setForm({ id: crypto.randomUUID(), name: "", enabled: false, sort_order: Math.min(999999, Math.max(0, ...published.items.map((item) => item.sort_order)) + 1), image: "", href: "", alt: { zh: "", en: "" } })}><Plus className="h-4 w-4" />{t("ads.add")}</button>
    </div>
    <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-border bg-muted/50 text-muted-foreground"><tr>{(["ads.preview", "ads.name", "admin.sortOrderLabel", "ads.status", "ads.link", "ads.actions"] as const).map((key) => <th key={key} className="whitespace-nowrap px-4 py-3 font-medium">{t(key)}</th>)}</tr></thead>
          <tbody>{ordered.slice((page - 1) * 10, page * 10).map((item) => <tr key={item.id} className="border-b border-border last:border-0 hover:bg-muted/30">
            <td className="px-4 py-3"><img src={item.image} alt="" width={96} height={32} loading="lazy" referrerPolicy="no-referrer" className="h-8 w-24 min-w-24 rounded bg-muted object-cover" /></td>
            <td className="max-w-52 truncate px-4 py-3" title={item.name || item.alt.zh}>{item.name || item.alt.zh}</td>
            <td className="px-4 py-3">{item.sort_order}</td>
            <td className="px-4 py-3"><label className="flex items-center gap-2 whitespace-nowrap"><Switch disabled={busy} checked={item.enabled} onCheckedChange={(enabled) => void persist({ ...published, items: published.items.map((ad) => ad.id === item.id ? { ...ad, enabled } : ad) })} aria-label={t("ads.itemEnabled") + ": " + (item.name || item.id)} /><span className="text-xs text-muted-foreground">{t(item.enabled ? "ads.on" : "ads.off")}</span></label></td>
            <td className="max-w-52 truncate px-4 py-3"><a href={item.href} target="_blank" rel="noopener noreferrer" title={item.href} className="text-primary hover:underline">{item.href}</a></td>
            <td className="px-4 py-3"><div className="flex gap-1"><button type="button" disabled={busy} className="rounded-md p-2 text-muted-foreground hover:bg-accent disabled:opacity-50" aria-label={t("ads.edit") + ": " + (item.name || item.id)} onClick={() => setForm(structuredClone(item))}><Edit className="h-4 w-4" /></button><button type="button" disabled={busy} className="rounded-md p-2 text-destructive hover:bg-destructive/10 disabled:opacity-50" aria-label={t("admin.delete") + ": " + (item.name || item.id)} onClick={() => setDeleteId(item.id)}><Trash2 className="h-4 w-4" /></button></div></td>
          </tr>)}</tbody>
        </table>
      </div>
      {!published.items.length && <p className="p-8 text-center text-sm text-muted-foreground">{t("ads.empty")}</p>}
      <Pagination page={page} pageSize={10} total={published.items.length} onChange={setPage} />
    </div>
    <Modal open={form !== null} onClose={closeForm} className="max-h-[90vh] max-w-2xl overflow-y-auto">
      {form && <>
        <div className="flex items-center justify-between border-b border-border px-6 py-4"><h2 className="text-lg font-semibold">{t(published.items.some((ad) => ad.id === form.id) ? "ads.edit" : "ads.add")}</h2><button type="button" disabled={busy} onClick={closeForm} aria-label={t("ads.close")} className="rounded-md p-1 hover:bg-accent"><X className="h-5 w-5" /></button></div>
        <fieldset disabled={busy} className="flex min-w-0 flex-col gap-5 p-6">
          <label className="flex flex-col gap-1.5 text-sm font-medium">{t("ads.name")}<input autoFocus className={inputClass} maxLength={80} value={form.name ?? ""} onChange={(e) => setForm({ ...form, name: e.target.value })} /></label>
          <div className="grid items-center gap-4 sm:grid-cols-2"><label className="flex flex-col gap-1.5 text-sm font-medium">{t("admin.sortOrderLabel")}<input type="number" min={0} max={999999} step={1} className={inputClass} value={Number.isNaN(form.sort_order) ? "" : form.sort_order} onChange={(e) => setForm({ ...form, sort_order: e.target.valueAsNumber })} /><span className="text-xs font-normal text-muted-foreground">{t("admin.sortOrderHint")}</span></label><label className="flex items-center gap-2 text-sm"><Switch disabled={busy} checked={form.enabled} onCheckedChange={(enabled) => setForm({ ...form, enabled })} />{t("ads.itemEnabled")}</label></div>
          <label className="flex flex-col gap-1.5 text-sm font-medium">{t("ads.link")}<input className={inputClass} type="url" maxLength={2048} placeholder="https://" value={form.href} onChange={(e) => setForm({ ...form, href: e.target.value })} /></label>
          {(["zh", "en"] as const).map((lang) => <label key={lang} className="flex flex-col gap-1.5 text-sm font-medium">{t(lang === "zh" ? "ads.altZh" : "ads.altEn")}<textarea className={inputClass} maxLength={300} value={form.alt[lang]} onChange={(e) => setForm({ ...form, alt: { ...form.alt, [lang]: e.target.value } })} /></label>)}
          <div className="space-y-1 text-xs leading-relaxed text-muted-foreground"><p>{t("ads.formats")}</p><p>{t("ads.dimensions")}</p><p>{t("ads.fallback")}</p></div>
          {imageInput("image")}
          <details><summary className="cursor-pointer text-sm font-medium">{t("ads.variants")}</summary><div className="mt-3 grid gap-3">{imageFields.slice(1).map(imageInput)}</div></details>
        </fieldset>
        <div className="flex justify-end gap-3 border-t border-border px-6 py-4"><button type="button" disabled={busy} className={buttonClass} onClick={closeForm}>{t("admin.cancel")}</button><button type="button" disabled={busy} className={primaryClass} onClick={saveForm}>{busy && <Loader2 className="h-4 w-4 animate-spin" />}{t(saving ? "admin.saving" : "admin.save")}</button></div>
      </>}
    </Modal>
    <Modal open={deleteId !== null} onClose={() => { if (!pending.current) setDeleteId(null) }} className="max-w-md">
      <div className="p-6"><h3 className="font-semibold">{t("admin.deleteConfirm")}</h3><p className="mt-2 text-sm text-muted-foreground">{t("ads.deleteHint")}</p><div className="mt-5 flex justify-end gap-3"><button type="button" disabled={busy} className={buttonClass} onClick={() => setDeleteId(null)}>{t("admin.cancel")}</button><button type="button" disabled={busy} className="rounded-lg bg-destructive px-4 py-2 text-sm font-medium text-destructive-foreground disabled:opacity-50" onClick={async () => { if (await persist({ ...published, items: published.items.filter((item) => item.id !== deleteId) })) setDeleteId(null) }}>{t("admin.delete")}</button></div></div>
    </Modal>
  </div>
}
