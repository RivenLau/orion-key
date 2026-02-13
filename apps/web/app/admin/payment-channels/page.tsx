"use client"

import { useState, useEffect } from "react"
import { Plus, Edit, Trash2, ToggleLeft, ToggleRight, X, AlertCircle } from "lucide-react"
import { cn } from "@/lib/utils"
import { useLocale } from "@/lib/context"
import { toast } from "sonner"
import { adminPaymentApi, withMockFallback } from "@/services/api"
import { mockPaymentChannels } from "@/lib/mock-data"
import type { PaymentChannelItem } from "@/types"

export default function AdminPaymentChannelsPage() {
  const { t } = useLocale()
  const [channels, setChannels] = useState<PaymentChannelItem[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [formData, setFormData] = useState({
    channel_code: "",
    channel_name: "",
    is_enabled: true,
    sort_order: "",
  })

  const fetchChannels = async () => {
    try {
      const data = await withMockFallback(
        () => adminPaymentApi.getList(),
        () => [...mockPaymentChannels]
      )
      setChannels(data)
    } catch {
      setChannels([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchChannels() }, [])

  const handleEdit = (channel: PaymentChannelItem) => {
    setEditId(channel.id)
    setFormData({
      channel_code: channel.channel_code,
      channel_name: channel.channel_name,
      is_enabled: channel.is_enabled,
      sort_order: String(channel.sort_order),
    })
    setShowModal(true)
  }

  const handleCloseModal = () => {
    setShowModal(false)
    setEditId(null)
    setFormData({ channel_code: "", channel_name: "", is_enabled: true, sort_order: "" })
  }

  const handleSave = async () => {
    if (!formData.channel_code.trim() || !formData.channel_name.trim()) {
      toast.error("请填写渠道编码和名称")
      return
    }
    setSaving(true)
    try {
      if (editId) {
        await withMockFallback(
          () => adminPaymentApi.update(editId, {
            channel_name: formData.channel_name,
            is_enabled: formData.is_enabled,
            sort_order: parseInt(formData.sort_order) || 0,
          }),
          () => null
        )
      } else {
        await withMockFallback(
          () => adminPaymentApi.create({
            channel_code: formData.channel_code,
            channel_name: formData.channel_name,
            is_enabled: formData.is_enabled,
            sort_order: parseInt(formData.sort_order) || 0,
          }),
          () => null
        )
      }
      toast.success("保存成功")
      handleCloseModal()
      await fetchChannels()
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "保存失败")
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id: string) => {
    try {
      await withMockFallback(
        () => adminPaymentApi.delete(id),
        () => null
      )
      toast.success("删除成功")
      setShowDeleteConfirm(null)
      await fetchChannels()
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "删除失败")
    }
  }

  const handleToggle = async (channel: PaymentChannelItem) => {
    try {
      await withMockFallback(
        () => adminPaymentApi.update(channel.id, { is_enabled: !channel.is_enabled }),
        () => null
      )
      toast.success(channel.is_enabled ? "已禁用" : "已启用")
      await fetchChannels()
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "操作失败")
    }
  }

  if (loading) {
    return (
      <div className="flex flex-col gap-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">{t("admin.payment")}</h1>
          <p className="text-sm text-muted-foreground">{t("admin.paymentDesc")}</p>
        </div>
        <div className="flex items-center justify-center py-24">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">{t("admin.payment")}</h1>
          <p className="text-sm text-muted-foreground">{t("admin.paymentDesc")}</p>
        </div>
        <button
          type="button"
          className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground shadow-sm hover:bg-primary/90 transition-colors"
          onClick={() => {
            setEditId(null)
            setFormData({ channel_code: "", channel_name: "", is_enabled: true, sort_order: "" })
            setShowModal(true)
          }}
        >
          <Plus className="h-4 w-4" />
          {t("admin.addChannel")}
        </button>
      </div>

      {/* Channel Cards */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {channels.map((channel) => (
          <div
            key={channel.id}
            className={cn(
              "rounded-xl border bg-card p-5 shadow-sm transition-colors",
              channel.is_enabled ? "border-border" : "border-border opacity-60"
            )}
          >
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className={cn(
                  "flex h-10 w-10 items-center justify-center rounded-lg",
                  channel.is_enabled ? "bg-primary/10" : "bg-muted"
                )}>
                  <span className={cn("text-sm font-bold", channel.is_enabled ? "text-primary" : "text-muted-foreground")}>
                    {channel.channel_code.slice(0, 2).toUpperCase()}
                  </span>
                </div>
                <div>
                  <h3 className="font-medium text-foreground">{channel.channel_name}</h3>
                  <p className="text-xs text-muted-foreground">{channel.channel_code}</p>
                </div>
              </div>
              <button
                type="button"
                className="text-muted-foreground hover:text-foreground transition-colors"
                title={channel.is_enabled ? "点击禁用" : "点击启用"}
                onClick={() => handleToggle(channel)}
              >
                {channel.is_enabled ? (
                  <ToggleRight className="h-6 w-6 text-primary" />
                ) : (
                  <ToggleLeft className="h-6 w-6" />
                )}
              </button>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-4 rounded-lg bg-muted/30 p-3">
              <div>
                <span className="text-xs text-muted-foreground">{t("admin.sortOrderLabel")}</span>
                <p className="text-sm font-medium text-foreground">{channel.sort_order}</p>
              </div>
              <div>
                <span className="text-xs text-muted-foreground">{t("admin.createdAt")}</span>
                <p className="text-sm font-medium text-foreground">
                  {new Date(channel.created_at).toLocaleDateString()}
                </p>
              </div>
            </div>

            <div className="mt-4 flex items-center justify-end gap-2">
              <button
                type="button"
                className="flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
                onClick={() => handleEdit(channel)}
              >
                <Edit className="h-3.5 w-3.5" />
                {t("admin.edit")}
              </button>
              <button
                type="button"
                className="flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors"
                onClick={() => setShowDeleteConfirm(channel.id)}
              >
                <Trash2 className="h-3.5 w-3.5" />
                {t("admin.delete")}
              </button>
            </div>
          </div>
        ))}
        {channels.length === 0 && (
          <div className="col-span-full py-12 text-center text-sm text-muted-foreground">{t("admin.noChannelData")}</div>
        )}
      </div>

      {/* Add/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={handleCloseModal}>
          <div className="w-full max-w-lg rounded-xl bg-card border border-border shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="border-b border-border px-6 py-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-foreground">
                {editId ? t("admin.editChannelTitle") : t("admin.addChannelTitle")}
              </h2>
              <button
                type="button"
                onClick={handleCloseModal}
                className="rounded-md p-1 text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="flex flex-col gap-4 p-6">
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-foreground">{`${t("admin.channelCode")} *`}</label>
                <input
                  type="text"
                  className="h-10 rounded-lg border border-input bg-background px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50"
                  placeholder="例如：alipay, wechat, usdt_trc20"
                  value={formData.channel_code}
                  onChange={(e) => setFormData({ ...formData, channel_code: e.target.value })}
                  disabled={!!editId}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-foreground">{`${t("admin.channelName")} *`}</label>
                <input
                  type="text"
                  className="h-10 rounded-lg border border-input bg-background px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                  placeholder="例如：支付宝"
                  value={formData.channel_name}
                  onChange={(e) => setFormData({ ...formData, channel_name: e.target.value })}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-foreground">{t("admin.sortOrderLabel")}</label>
                <input
                  type="number"
                  className="h-10 rounded-lg border border-input bg-background px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                  placeholder={t("admin.sortOrderHint")}
                  value={formData.sort_order}
                  onChange={(e) => setFormData({ ...formData, sort_order: e.target.value })}
                />
              </div>
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium text-foreground">{t("admin.enableStatus")}</label>
                <button
                  type="button"
                  className={cn(
                    "relative h-6 w-11 rounded-full transition-colors",
                    formData.is_enabled ? "bg-primary" : "bg-muted"
                  )}
                  onClick={() => setFormData({ ...formData, is_enabled: !formData.is_enabled })}
                >
                  <span className={cn(
                    "absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform",
                    formData.is_enabled && "translate-x-5"
                  )} />
                </button>
              </div>
            </div>
            <div className="flex justify-end gap-3 border-t border-border px-6 py-4">
              <button
                type="button"
                className="rounded-lg border border-input bg-transparent px-4 py-2 text-sm font-medium text-foreground hover:bg-accent transition-colors"
                onClick={handleCloseModal}
              >
                {t("admin.cancel")}
              </button>
              <button
                type="button"
                className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50"
                onClick={handleSave}
                disabled={saving}
              >
                {saving ? t("admin.saving") : t("admin.save")}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setShowDeleteConfirm(null)}>
          <div className="w-full max-w-md rounded-xl bg-card border border-border shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex flex-col gap-4 p-6">
              <div className="flex items-start gap-3">
                <div className="rounded-full bg-destructive/10 p-2">
                  <AlertCircle className="h-5 w-5 text-destructive" />
                </div>
                <div className="flex-1">
                  <h3 className="text-base font-semibold text-foreground">{t("admin.deleteConfirm")}</h3>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {t("admin.deleteChannelMsg")}
                  </p>
                </div>
              </div>
              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  className="rounded-lg border border-input bg-transparent px-4 py-2 text-sm font-medium text-foreground hover:bg-accent transition-colors"
                  onClick={() => setShowDeleteConfirm(null)}
                >
                  {t("admin.cancel")}
                </button>
                <button
                  type="button"
                  className="rounded-lg bg-destructive px-4 py-2 text-sm font-medium text-destructive-foreground hover:bg-destructive/90 transition-colors"
                  onClick={() => handleDelete(showDeleteConfirm)}
                >
                  {t("admin.delete")}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
