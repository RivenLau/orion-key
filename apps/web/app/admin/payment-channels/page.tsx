"use client"

import { useState, useEffect, useMemo } from "react"
import { Plus, Edit, Trash2, ToggleLeft, ToggleRight, X, AlertCircle, ChevronDown, Shield, Key } from "lucide-react"
import { cn } from "@/lib/utils"
import { useLocale } from "@/lib/context"
import { toast } from "sonner"
import { adminPaymentApi, withMockFallback, revalidateCache } from "@/services/api"
import { mockPaymentChannels } from "@/lib/mock-data"
import { Modal } from "@/components/ui/modal"
import type { PaymentChannelItem, PaymentChannelConfig, ProviderType } from "@/types"

// ============================================================
// Provider & Channel definitions
// ============================================================

interface ConfigField {
  key: string
  label: string
  placeholder: string
  type?: "password" | "text"
}

interface ProviderOption {
  type: ProviderType
  name: string
  description: string
  /** 该 provider 支持的 channel_code 列表 */
  channels: { code: string; name: string }[]
  configFields: ConfigField[]
}

const PROVIDER_OPTIONS: ProviderOption[] = [
  {
    type: "epay",
    name: "易支付（聚合支付）",
    description: "通过第三方聚合平台接入支付宝/微信，共用一套商户配置",
    channels: [
      { code: "alipay", name: "支付宝" },
      { code: "wechat", name: "微信支付" },
    ],
    configFields: [
      { key: "pid", label: "商户ID (PID)", placeholder: "例如：743794" },
      { key: "key", label: "商户密钥 (Key)", placeholder: "MD5 密钥", type: "password" },
      { key: "api_url", label: "API 地址", placeholder: "例如：https://pay.example.com/" },
      { key: "notify_url", label: "异步回调地址", placeholder: "例如：https://yourdomain.com/api/payments/webhook/epay" },
      { key: "return_url", label: "同步跳转地址", placeholder: "例如：https://yourdomain.com/pay" },
    ],
  },
  {
    type: "native_alipay",
    name: "原生支付宝",
    description: "直接对接支付宝开放平台，需要企业资质",
    channels: [{ code: "alipay", name: "支付宝" }],
    configFields: [
      { key: "appid", label: "应用 AppID", placeholder: "支付宝开放平台应用 AppID" },
      { key: "private_key", label: "应用私钥", placeholder: "RSA2 私钥", type: "password" },
      { key: "alipay_public_key", label: "支付宝公钥", placeholder: "支付宝平台提供的公钥", type: "password" },
      { key: "gateway_url", label: "网关地址", placeholder: "https://openapi.alipay.com/gateway.do" },
      { key: "notify_url", label: "异步回调地址", placeholder: "例如：https://yourdomain.com/api/payments/webhook/alipay" },
    ],
  },
  {
    type: "native_wxpay",
    name: "原生微信支付",
    description: "直接对接微信支付平台，需要企业资质",
    channels: [{ code: "wechat", name: "微信支付" }],
    configFields: [
      { key: "appid", label: "应用 AppID", placeholder: "微信公众号/小程序 AppID" },
      { key: "mchid", label: "商户号 (MchID)", placeholder: "微信支付商户号" },
      { key: "api_v3_key", label: "APIv3 密钥", placeholder: "微信支付 APIv3 密钥", type: "password" },
      { key: "serial_no", label: "证书序列号", placeholder: "API 证书序列号" },
      { key: "private_key_path", label: "私钥文件路径", placeholder: "例如：/certs/apiclient_key.pem" },
      { key: "notify_url", label: "异步回调地址", placeholder: "例如：https://yourdomain.com/api/payments/webhook/wxpay" },
    ],
  },
  {
    type: "usdt",
    name: "USDT 加密货币",
    description: "接收 USDT 加密货币付款（TRC-20 / BSC）",
    channels: [
      { code: "usdt_trc20", name: "USDT (TRC-20)" },
      { code: "usdt_bsc", name: "USDT (BSC)" },
    ],
    configFields: [
      { key: "wallet_address", label: "收款钱包地址", placeholder: "链上收款地址" },
      { key: "rate_api_url", label: "汇率 API 地址（可选）", placeholder: "例如：https://api.example.com/rate" },
    ],
  },
]

const PROVIDER_MAP = Object.fromEntries(PROVIDER_OPTIONS.map(p => [p.type, p]))

/** 获取 provider 的显示标签 */
function getProviderLabel(type: string): string {
  return PROVIDER_MAP[type]?.name ?? type
}

// ============================================================
// Page Component
// ============================================================

export default function AdminPaymentChannelsPage() {
  const { t } = useLocale()
  const [channels, setChannels] = useState<PaymentChannelItem[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [showKeys, setShowKeys] = useState(false)

  // Form state — step 1: provider, step 2: channel, step 3: config
  const [providerDropdownOpen, setProviderDropdownOpen] = useState(false)
  const [channelDropdownOpen, setChannelDropdownOpen] = useState(false)

  const [formData, setFormData] = useState({
    provider_type: "" as string,
    channel_code: "",
    channel_name: "",
    is_enabled: true,
    sort_order: "",
  })
  const [configData, setConfigData] = useState<Record<string, string>>({})

  // Current provider option
  const currentProvider = useMemo(
    () => PROVIDER_MAP[formData.provider_type] ?? null,
    [formData.provider_type]
  )

  // Available channel options based on selected provider
  const availableChannels = useMemo(
    () => currentProvider?.channels ?? [],
    [currentProvider]
  )

  // Already-used (channel_code + provider_type) combos (to prevent duplicates)
  const usedCombos = useMemo(
    () => {
      const set = new Set<string>()
      for (const c of channels) {
        if (editId && c.id === editId) continue // 编辑模式排除当前
        set.add(`${c.channel_code}__${c.provider_type}`)
      }
      return set
    },
    [channels, editId]
  )

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
      provider_type: channel.provider_type || "epay",
      channel_code: channel.channel_code,
      channel_name: channel.channel_name,
      is_enabled: channel.is_enabled,
      sort_order: String(channel.sort_order),
    })
    const config = channel.config_data
    if (config && typeof config === "object") {
      const parsed: Record<string, string> = {}
      for (const [k, v] of Object.entries(config)) {
        if (v != null) parsed[k] = String(v)
      }
      setConfigData(parsed)
    } else {
      setConfigData({})
    }
    setShowKeys(false)
    setShowModal(true)
  }

  const handleOpenCreate = () => {
    setEditId(null)
    setFormData({ provider_type: "", channel_code: "", channel_name: "", is_enabled: true, sort_order: "" })
    setConfigData({})
    setShowKeys(false)
    setShowModal(true)
  }

  const handleCloseModal = () => {
    setShowModal(false)
    setEditId(null)
    setFormData({ provider_type: "", channel_code: "", channel_name: "", is_enabled: true, sort_order: "" })
    setConfigData({})
    setProviderDropdownOpen(false)
    setChannelDropdownOpen(false)
    setShowKeys(false)
  }

  const handleSelectProvider = (provider: ProviderOption) => {
    // 如果该 provider 只有一个 channel，自动选中
    const autoChannel = provider.channels.length === 1 ? provider.channels[0] : null
    setFormData(prev => ({
      ...prev,
      provider_type: provider.type,
      channel_code: autoChannel?.code ?? "",
      channel_name: autoChannel?.name ?? "",
    }))
    setConfigData({})
    setProviderDropdownOpen(false)
  }

  const handleSelectChannel = (channel: { code: string; name: string }) => {
    setFormData(prev => ({
      ...prev,
      channel_code: channel.code,
      channel_name: channel.name,
    }))
    setChannelDropdownOpen(false)
  }

  const handleConfigChange = (key: string, value: string) => {
    setConfigData(prev => ({ ...prev, [key]: value }))
  }

  const handleSave = async () => {
    if (!formData.provider_type || !formData.channel_code.trim() || !formData.channel_name.trim()) {
      toast.error("请选择支付提供商和渠道类型")
      return
    }
    setSaving(true)

    const configObj: Record<string, string> = {}
    for (const [k, v] of Object.entries(configData)) {
      if (v && v.trim()) configObj[k] = v.trim()
    }
    const hasConfig = Object.keys(configObj).length > 0

    try {
      if (editId) {
        await withMockFallback(
          () => adminPaymentApi.update(editId, {
            channel_name: formData.channel_name,
            provider_type: formData.provider_type,
            config_data: hasConfig ? configObj : {},
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
            provider_type: formData.provider_type,
            config_data: hasConfig ? configObj : undefined,
            is_enabled: formData.is_enabled,
            sort_order: parseInt(formData.sort_order) || 0,
          }),
          () => null
        )
      }
      toast.success("保存成功")
      handleCloseModal()
      revalidateCache("payment-channels")
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
      revalidateCache("payment-channels")
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
      revalidateCache("payment-channels")
      await fetchChannels()
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "操作失败")
    }
  }

  const getConfigStatus = (channel: PaymentChannelItem) => {
    const config = channel.config_data
    if (!config || typeof config !== "object") return false
    return Object.values(config).some(v => v != null && String(v).trim() !== "")
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
          onClick={handleOpenCreate}
        >
          <Plus className="h-4 w-4" />
          {t("admin.addChannel")}
        </button>
      </div>

      {/* Channel Cards */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {channels.map((channel) => {
          const hasConfig = getConfigStatus(channel)
          return (
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
                    <p className="text-xs text-muted-foreground">
                      {channel.channel_code}
                      <span className="mx-1">·</span>
                      <span className="text-primary/80">{getProviderLabel(channel.provider_type)}</span>
                    </p>
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

              <div className="mt-4 grid grid-cols-3 gap-4 rounded-lg bg-muted/30 p-3">
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
                <div>
                  <span className="text-xs text-muted-foreground">支付配置</span>
                  <p className={cn("text-sm font-medium", hasConfig ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground")}>
                    {hasConfig ? "已配置" : "未配置"}
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
          )
        })}
        {channels.length === 0 && (
          <div className="col-span-full py-12 text-center text-sm text-muted-foreground">{t("admin.noChannelData")}</div>
        )}
      </div>

      {/* Add/Edit Modal */}
      <Modal open={showModal} onClose={handleCloseModal} className="max-w-2xl">
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
          {/* Step 1: Provider Type */}
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-foreground">支付提供商 *</label>
            <div className="relative">
              <button
                type="button"
                className={cn(
                  "flex h-10 w-full items-center justify-between rounded-lg border bg-background px-3 text-sm transition-colors",
                  providerDropdownOpen ? "border-ring ring-2 ring-ring" : "border-input",
                  editId ? "opacity-50 cursor-not-allowed" : "cursor-pointer hover:border-muted-foreground/50"
                )}
                onClick={() => !editId && setProviderDropdownOpen(!providerDropdownOpen)}
                disabled={!!editId}
              >
                <span className={formData.provider_type ? "text-foreground" : "text-muted-foreground"}>
                  {currentProvider ? currentProvider.name : "请选择支付提供商"}
                </span>
                <ChevronDown className={cn("h-4 w-4 text-muted-foreground transition-transform", providerDropdownOpen && "rotate-180")} />
              </button>
              {providerDropdownOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setProviderDropdownOpen(false)} />
                  <div className="absolute left-0 right-0 z-50 mt-1 overflow-hidden rounded-lg border border-border bg-popover shadow-lg">
                    {PROVIDER_OPTIONS.map((option) => (
                      <button
                        key={option.type}
                        type="button"
                        className={cn(
                          "flex w-full flex-col items-start px-3 py-2.5 text-sm transition-colors hover:bg-accent cursor-pointer",
                          formData.provider_type === option.type && "bg-accent/50"
                        )}
                        onClick={() => handleSelectProvider(option)}
                      >
                        <span className="font-medium text-foreground">{option.name}</span>
                        <span className="text-xs text-muted-foreground">{option.description}</span>
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Step 2: Channel Code (only if provider has multiple channels) */}
          {currentProvider && availableChannels.length > 1 && (
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-foreground">支付方式 *</label>
              <div className="relative">
                <button
                  type="button"
                  className={cn(
                    "flex h-10 w-full items-center justify-between rounded-lg border bg-background px-3 text-sm transition-colors",
                    channelDropdownOpen ? "border-ring ring-2 ring-ring" : "border-input",
                    editId ? "opacity-50 cursor-not-allowed" : "cursor-pointer hover:border-muted-foreground/50"
                  )}
                  onClick={() => !editId && setChannelDropdownOpen(!channelDropdownOpen)}
                  disabled={!!editId}
                >
                  <span className={formData.channel_code ? "text-foreground" : "text-muted-foreground"}>
                    {formData.channel_code
                      ? `${formData.channel_name} (${formData.channel_code})`
                      : "请选择支付方式"
                    }
                  </span>
                  <ChevronDown className={cn("h-4 w-4 text-muted-foreground transition-transform", channelDropdownOpen && "rotate-180")} />
                </button>
                {channelDropdownOpen && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setChannelDropdownOpen(false)} />
                    <div className="absolute left-0 right-0 z-50 mt-1 overflow-hidden rounded-lg border border-border bg-popover shadow-lg">
                      {availableChannels.map((ch) => {
                        const isUsed = usedCombos.has(`${ch.code}__${formData.provider_type}`)
                        return (
                          <button
                            key={ch.code}
                            type="button"
                            className={cn(
                              "flex w-full items-center justify-between px-3 py-2.5 text-sm transition-colors",
                              isUsed
                                ? "opacity-40 cursor-not-allowed"
                                : "hover:bg-accent cursor-pointer",
                              formData.channel_code === ch.code && "bg-accent/50 font-medium"
                            )}
                            onClick={() => !isUsed && handleSelectChannel(ch)}
                            disabled={isUsed}
                          >
                            <span className="text-foreground">{ch.name}</span>
                            <span className="text-xs text-muted-foreground">{ch.code}</span>
                          </button>
                        )
                      })}
                    </div>
                  </>
                )}
              </div>
            </div>
          )}

          {/* Channel Name (editable) */}
          {formData.channel_code && (
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-foreground">{`${t("admin.channelName")} *`}</label>
              <input
                type="text"
                className="h-10 rounded-lg border border-input bg-background px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                placeholder="显示名称（可自定义）"
                value={formData.channel_name}
                onChange={(e) => setFormData({ ...formData, channel_name: e.target.value })}
              />
            </div>
          )}

          {/* Dynamic Config Fields */}
          {currentProvider && currentProvider.configFields.length > 0 && formData.channel_code && (
            <div className="flex flex-col gap-3 rounded-lg border border-border bg-muted/20 p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Shield className="h-4 w-4 text-primary" />
                  <span className="text-sm font-medium text-foreground">
                    {currentProvider.name} 配置
                  </span>
                </div>
                {currentProvider.configFields.some(f => f.type === "password") && (
                  <button
                    type="button"
                    className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
                    onClick={() => setShowKeys(!showKeys)}
                  >
                    <Key className="h-3 w-3" />
                    {showKeys ? "隐藏密钥" : "显示密钥"}
                  </button>
                )}
              </div>
              {currentProvider.configFields.map((field) => (
                <div key={field.key} className="flex flex-col gap-1">
                  <label className="text-xs font-medium text-muted-foreground">{field.label}</label>
                  <input
                    type={field.type === "password" && !showKeys ? "password" : "text"}
                    className="h-9 rounded-md border border-input bg-background px-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                    placeholder={field.placeholder}
                    value={configData[field.key] ?? ""}
                    onChange={(e) => handleConfigChange(field.key, e.target.value)}
                  />
                </div>
              ))}
            </div>
          )}

          {/* Sort Order */}
          {formData.channel_code && (
            <>
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

              {/* Enable toggle */}
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
            </>
          )}
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
            disabled={saving || !formData.provider_type || !formData.channel_code}
          >
            {saving ? t("admin.saving") : t("admin.save")}
          </button>
        </div>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal open={showDeleteConfirm !== null} onClose={() => setShowDeleteConfirm(null)} className="max-w-md">
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
              onClick={() => showDeleteConfirm && handleDelete(showDeleteConfirm)}
            >
              {t("admin.delete")}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
