"use client"

import { useState, useEffect } from "react"
import { ChevronDown, ChevronLeft, ChevronRight, Eye, CheckCircle, XCircle, X, ExternalLink } from "lucide-react"
import { cn } from "@/lib/utils"
import { useLocale } from "@/lib/context"
import { toast } from "sonner"
import { adminTxidReviewApi, withMockFallback } from "@/services/api"
import { Modal } from "@/components/ui/modal"
import type { UnmatchedTransaction, TxidReviewStatus } from "@/types"
import type { TranslationKey } from "@/lib/i18n"

const ITEMS_PER_PAGE = 10

function statusBadge(status: TxidReviewStatus, t: (k: TranslationKey) => string) {
  const map: Record<TxidReviewStatus, { bg: string; text: string; key: TranslationKey }> = {
    PENDING_REVIEW: { bg: "bg-amber-500/10", text: "text-amber-600", key: "admin.txidPendingReview" },
    AUTO_APPROVED: { bg: "bg-emerald-500/10", text: "text-emerald-600", key: "admin.txidAutoApproved" },
    AUTO_REJECTED: { bg: "bg-red-500/10", text: "text-red-600", key: "admin.txidAutoRejected" },
    APPROVED: { bg: "bg-emerald-500/10", text: "text-emerald-600", key: "admin.txidApproved" },
    REJECTED: { bg: "bg-red-500/10", text: "text-red-600", key: "admin.txidRejected" },
  }
  const s = map[status]
  if (!s) {
    return (
      <span className={cn("rounded-full px-2.5 py-0.5 text-xs font-medium", "bg-muted", "text-muted-foreground")}>
        {status}
      </span>
    )
  }
  return (
    <span className={cn("rounded-full px-2.5 py-0.5 text-xs font-medium", s.bg, s.text)}>
      {t(s.key)}
    </span>
  )
}

function shortenId(id: string) {
  return id.length > 16 ? `${id.slice(0, 8)}...${id.slice(-4)}` : id
}

function shortenTxid(txid: string) {
  return txid.length > 20 ? `${txid.slice(0, 10)}...${txid.slice(-6)}` : txid
}

function chainLabel(chain: string | null) {
  if (!chain) return "-"
  if (chain.includes("trc20")) return "TRC20"
  if (chain.includes("bep20")) return "BEP20"
  return chain.toUpperCase()
}

function txidExplorerUrl(txid: string, chain: string | null) {
  if (chain?.includes("trc20")) return `https://tronscan.org/#/transaction/${txid}`
  if (chain?.includes("bep20")) return `https://bscscan.com/tx/${txid}`
  return null
}

export default function AdminTxidReviewsPage() {
  const { t } = useLocale()
  const [records, setRecords] = useState<UnmatchedTransaction[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState<TxidReviewStatus | "">("")
  const [currentPage, setCurrentPage] = useState(1)
  const [showDetail, setShowDetail] = useState<UnmatchedTransaction | null>(null)
  const [rejectReason, setRejectReason] = useState("")
  const [actionLoading, setActionLoading] = useState(false)
  const [approveConfirm, setApproveConfirm] = useState<UnmatchedTransaction | null>(null)
  const [rejectConfirm, setRejectConfirm] = useState<UnmatchedTransaction | null>(null)

  const copyToClipboard = (text: string) => {
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(text).then(
        () => toast.success(t("order.copied")),
        () => fallbackCopy(text)
      )
    } else {
      fallbackCopy(text)
    }
    function fallbackCopy(val: string) {
      const ta = document.createElement("textarea")
      ta.value = val
      ta.style.position = "fixed"
      ta.style.opacity = "0"
      document.body.appendChild(ta)
      ta.select()
      document.execCommand("copy")
      document.body.removeChild(ta)
      toast.success(t("order.copied"))
    }
  }

  const STATUS_OPTIONS: { value: TxidReviewStatus | ""; key: TranslationKey }[] = [
    { value: "", key: "admin.txidAllStatus" },
    { value: "PENDING_REVIEW", key: "admin.txidPendingReview" },
    { value: "AUTO_APPROVED", key: "admin.txidAutoApproved" },
    { value: "AUTO_REJECTED", key: "admin.txidAutoRejected" },
    { value: "APPROVED", key: "admin.txidApproved" },
    { value: "REJECTED", key: "admin.txidRejected" },
  ]

  const fetchList = async () => {
    setLoading(true)
    try {
      const data = await withMockFallback(
        () => adminTxidReviewApi.getList({
          status: statusFilter || undefined,
          page: currentPage,
          page_size: ITEMS_PER_PAGE,
        }),
        () => ({ list: [] as UnmatchedTransaction[], pagination: { page: 1, page_size: ITEMS_PER_PAGE, total: 0 } })
      )
      setRecords(data.list)
      setTotal(data.pagination.total)
    } catch {
      setRecords([])
      setTotal(0)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchList() }, [currentPage, statusFilter])

  const totalPages = Math.ceil(total / ITEMS_PER_PAGE)

  const handleApprove = async (record: UnmatchedTransaction) => {
    setActionLoading(true)
    try {
      await withMockFallback(
        () => adminTxidReviewApi.approve(record.id),
        () => null
      )
      toast.success(t("admin.txidApproveSuccess"))
      setApproveConfirm(null)
      setShowDetail(null)
      await fetchList()
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : t("admin.txidActionFailed"))
    } finally {
      setActionLoading(false)
    }
  }

  const handleReject = async (record: UnmatchedTransaction) => {
    if (!rejectReason.trim()) {
      toast.error(t("admin.txidRejectReasonRequired"))
      return
    }
    setActionLoading(true)
    try {
      await withMockFallback(
        () => adminTxidReviewApi.reject(record.id, rejectReason.trim()),
        () => null
      )
      toast.success(t("admin.txidRejectSuccess"))
      setRejectReason("")
      setRejectConfirm(null)
      setShowDetail(null)
      await fetchList()
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : t("admin.txidActionFailed"))
    } finally {
      setActionLoading(false)
    }
  }

  const openDetail = (record: UnmatchedTransaction) => {
    setShowDetail(record)
    setRejectReason("")
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-foreground">{t("admin.txidReview")}</h1>
        <p className="text-sm text-muted-foreground">{t("admin.txidReviewDesc")}</p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative">
          <select
            className="h-10 appearance-none rounded-lg border border-input bg-background pl-3 pr-8 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            value={statusFilter}
            onChange={(e) => { setStatusFilter(e.target.value as TxidReviewStatus | ""); setCurrentPage(1) }}
          >
            {STATUS_OPTIONS.map(opt => (
              <option key={opt.value} value={opt.value}>{t(opt.key)}</option>
            ))}
          </select>
          <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        </div>
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">{t("admin.txidOrderId")}</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">TXID</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">{t("admin.txidChain")}</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">{t("admin.txidExpectedAmount")}</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">{t("admin.txidOnChainAmount")}</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">{t("admin.txidAmountDiff")}</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">{t("admin.txidSource")}</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">{t("admin.txidStatus")}</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">{t("admin.txidSubmittedAt")}</th>
                <th className="px-4 py-3 text-right font-medium text-muted-foreground">{t("admin.actions")}</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={10} className="py-12">
                    <div className="flex items-center justify-center">
                      <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                    </div>
                  </td>
                </tr>
              ) : records.length === 0 ? (
                <tr>
                  <td colSpan={10} className="py-8 text-center text-sm text-muted-foreground">{t("admin.txidNoRecords")}</td>
                </tr>
              ) : (
                records.map((record) => {
                  const explorerUrl = txidExplorerUrl(record.txid, record.chain)
                  return (
                    <tr key={record.id} className="border-b border-border/50 last:border-0 hover:bg-muted/20 transition-colors">
                      <td className="px-4 py-3">
                        <span
                          className="cursor-pointer font-mono text-sm font-medium text-foreground underline-offset-4 transition-colors hover:underline hover:text-primary"
                          title={record.order_id}
                          onClick={() => copyToClipboard(record.order_id)}
                        >
                          {shortenId(record.order_id)}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1">
                          <span
                            className="cursor-pointer font-mono text-sm font-medium text-foreground underline-offset-4 transition-colors hover:underline hover:text-primary"
                            title={record.txid}
                            onClick={() => copyToClipboard(record.txid)}
                          >
                            {shortenTxid(record.txid)}
                          </span>
                          {explorerUrl && (
                            <a
                              href={explorerUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-muted-foreground hover:text-primary transition-colors"
                              title={t("admin.txidViewExplorer")}
                            >
                              <ExternalLink className="h-3 w-3" />
                            </a>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-foreground">{chainLabel(record.chain)}</td>
                      <td className="px-4 py-3 text-foreground">{record.expected_amount} USDT</td>
                      <td className="px-4 py-3 text-foreground">
                        {record.on_chain_amount != null ? `${record.on_chain_amount} USDT` : "-"}
                      </td>
                      <td className="px-4 py-3">
                        {record.amount_diff != null ? (
                          <span className={cn(
                            "font-medium",
                            record.amount_diff === 0 ? "text-emerald-600" :
                            Math.abs(record.amount_diff) < 1 ? "text-amber-600" : "text-red-600"
                          )}>
                            {record.amount_diff > 0 ? "+" : ""}{record.amount_diff}
                          </span>
                        ) : "-"}
                      </td>
                      <td className="px-4 py-3">
                        <span className={cn(
                          "rounded-full px-2 py-0.5 text-xs font-medium",
                          record.source === "USER_SUBMIT"
                            ? "bg-blue-500/10 text-blue-600"
                            : "bg-purple-500/10 text-purple-600"
                        )}>
                          {record.source === "USER_SUBMIT" ? t("admin.txidSourceUser") : t("admin.txidSourceSystem")}
                        </span>
                      </td>
                      <td className="px-4 py-3">{statusBadge(record.status, t)}</td>
                      <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">
                        {new Date(record.submitted_at || record.created_at).toLocaleString()}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            type="button"
                            onClick={() => openDetail(record)}
                            className="rounded-md p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
                            title={t("admin.txidViewDetail")}
                          >
                            <Eye className="h-4 w-4" />
                          </button>
                          {record.status === "PENDING_REVIEW" && (
                            <>
                              <button
                                type="button"
                                onClick={() => setApproveConfirm(record)}
                                className="rounded-md p-1.5 text-muted-foreground hover:bg-emerald-500/10 hover:text-emerald-600 transition-colors"
                                title={t("admin.txidApproveLabel")}
                              >
                                <CheckCircle className="h-4 w-4" />
                              </button>
                              <button
                                type="button"
                                onClick={() => { setRejectReason(""); setRejectConfirm(record) }}
                                className="rounded-md p-1.5 text-muted-foreground hover:bg-red-500/10 hover:text-red-600 transition-colors"
                                title={t("admin.txidRejectLabel")}
                              >
                                <XCircle className="h-4 w-4" />
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            {t("common.page")} {currentPage} / {totalPages}{t("admin.totalRecords")} {total} {t("admin.records")}
          </p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="flex h-9 w-9 items-center justify-center rounded-lg border border-input bg-transparent text-muted-foreground hover:bg-accent hover:text-foreground transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            {Array.from({ length: totalPages }, (_, i) => i + 1)
              .filter(page => page === 1 || page === totalPages || Math.abs(page - currentPage) <= 1)
              .map((page, index, array) => (
                <div key={page} className="flex items-center gap-1">
                  {index > 0 && array[index - 1] !== page - 1 && (
                    <span className="px-2 text-muted-foreground">...</span>
                  )}
                  <button
                    type="button"
                    onClick={() => setCurrentPage(page)}
                    className={cn(
                      "flex h-9 w-9 items-center justify-center rounded-lg text-sm font-medium transition-colors",
                      currentPage === page
                        ? "bg-primary text-primary-foreground"
                        : "border border-input bg-transparent text-foreground hover:bg-accent"
                    )}
                  >
                    {page}
                  </button>
                </div>
              ))}
            <button
              type="button"
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="flex h-9 w-9 items-center justify-center rounded-lg border border-input bg-transparent text-muted-foreground hover:bg-accent hover:text-foreground transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {/* Detail Modal */}
      <Modal open={showDetail !== null} onClose={() => setShowDetail(null)} className="max-w-lg">
        {showDetail && (() => {
          const explorerUrl = txidExplorerUrl(showDetail.txid, showDetail.chain)
          return (
            <>
              <div className="border-b border-border px-6 py-4 flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-foreground">{t("admin.txidDetail")}</h2>
                  <p className="font-mono text-xs text-muted-foreground">{showDetail.id}</p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowDetail(null)}
                  className="rounded-md p-1 text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
              <div className="flex flex-col gap-5 p-6">
                <div className="grid grid-cols-2 gap-x-8 gap-y-4 text-sm">
                  <div className="flex flex-col gap-1">
                    <span className="text-muted-foreground">{t("admin.txidRelatedOrder")}</span>
                    <span
                      className="cursor-pointer font-mono font-medium text-foreground underline-offset-4 transition-colors hover:underline hover:text-primary"
                      title={showDetail.order_id}
                      onClick={() => copyToClipboard(showDetail.order_id)}
                    >
                      {shortenId(showDetail.order_id)}
                    </span>
                  </div>
                  <div className="flex flex-col gap-1">
                    <span className="text-muted-foreground">{t("admin.txidChain")}</span>
                    <span className="text-foreground">{chainLabel(showDetail.chain)}</span>
                  </div>
                  <div className="col-span-2 flex flex-col gap-1">
                    <span className="text-muted-foreground">TXID</span>
                    <div className="flex items-center gap-2">
                      <code
                        className="cursor-pointer break-all rounded bg-muted/50 px-2 py-1 text-xs text-foreground underline-offset-4 transition-colors hover:underline hover:text-primary"
                        onClick={() => copyToClipboard(showDetail.txid)}
                      >
                        {showDetail.txid}
                      </code>
                      {explorerUrl && (
                        <a
                          href={explorerUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="shrink-0 text-primary hover:underline"
                        >
                          <ExternalLink className="h-3.5 w-3.5" />
                        </a>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-col gap-1">
                    <span className="text-muted-foreground">{t("admin.txidExpected")}</span>
                    <span className="font-medium text-foreground">{showDetail.expected_amount} USDT</span>
                  </div>
                  <div className="flex flex-col gap-1">
                    <span className="text-muted-foreground">{t("admin.txidOnChain")}</span>
                    <span className="font-medium text-foreground">
                      {showDetail.on_chain_amount != null ? `${showDetail.on_chain_amount} USDT` : t("admin.txidOnChainNA")}
                    </span>
                  </div>
                  {showDetail.amount_diff != null && (
                    <div className="flex flex-col gap-1">
                      <span className="text-muted-foreground">{t("admin.txidDiff")}</span>
                      <span className={cn(
                        "font-medium",
                        showDetail.amount_diff === 0 ? "text-emerald-600" :
                        Math.abs(showDetail.amount_diff) < 1 ? "text-amber-600" : "text-red-600"
                      )}>
                        {showDetail.amount_diff > 0 ? "+" : ""}{showDetail.amount_diff} USDT
                      </span>
                    </div>
                  )}
                  <div className="flex flex-col gap-1">
                    <span className="text-muted-foreground">{t("admin.txidSource")}</span>
                    <span className="text-foreground">
                      {showDetail.source === "USER_SUBMIT" ? t("admin.txidSourceUser") : t("admin.txidSourceSystem")}
                    </span>
                  </div>
                  {showDetail.on_chain_from && (
                    <div className="col-span-2 flex flex-col gap-1">
                      <span className="text-muted-foreground">{t("admin.txidFrom")}</span>
                      <code
                        className="cursor-pointer break-all text-foreground underline-offset-4 transition-colors hover:underline hover:text-primary"
                        onClick={() => copyToClipboard(showDetail.on_chain_from!)}
                      >
                        {showDetail.on_chain_from}
                      </code>
                    </div>
                  )}
                  {showDetail.on_chain_to && (
                    <div className="col-span-2 flex flex-col gap-1">
                      <span className="text-muted-foreground">{t("admin.txidTo")}</span>
                      <code
                        className="cursor-pointer break-all text-foreground underline-offset-4 transition-colors hover:underline hover:text-primary"
                        onClick={() => copyToClipboard(showDetail.on_chain_to!)}
                      >
                        {showDetail.on_chain_to}
                      </code>
                    </div>
                  )}
                  <div className="flex flex-col gap-1 items-start">
                    <span className="text-muted-foreground">{t("admin.txidStatus")}</span>
                    {statusBadge(showDetail.status, t)}
                  </div>
                  {showDetail.verify_reason && (
                    <div className="col-span-2 flex flex-col gap-1">
                      <span className="text-muted-foreground">{t("admin.txidVerifyReason")}</span>
                      <span className="text-foreground">{showDetail.verify_reason}</span>
                    </div>
                  )}
                  <div className="flex flex-col gap-1">
                    <span className="text-muted-foreground">{t("admin.txidSubmittedAt")}</span>
                    <span className="text-foreground">
                      {new Date(showDetail.submitted_at || showDetail.created_at).toLocaleString()}
                    </span>
                  </div>
                  {showDetail.reviewed_at && (
                    <div className="flex flex-col gap-1">
                      <span className="text-muted-foreground">{t("admin.txidReviewedAt")}</span>
                      <span className="text-foreground">{new Date(showDetail.reviewed_at).toLocaleString()}</span>
                    </div>
                  )}
                </div>

              </div>
              <div className="flex justify-end gap-3 border-t border-border px-6 py-4">
                {showDetail.status === "PENDING_REVIEW" && (
                  <>
                    <button
                      type="button"
                      className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 transition-colors"
                      onClick={() => setApproveConfirm(showDetail)}
                    >
                      {t("admin.txidApproveLabel")}
                    </button>
                    <button
                      type="button"
                      className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 transition-colors"
                      onClick={() => { setRejectReason(""); setRejectConfirm(showDetail) }}
                    >
                      {t("admin.txidRejectLabel")}
                    </button>
                  </>
                )}
                <button
                  type="button"
                  className="rounded-lg border border-input bg-transparent px-4 py-2 text-sm font-medium text-foreground hover:bg-accent transition-colors"
                  onClick={() => setShowDetail(null)}
                >
                  {t("common.close")}
                </button>
              </div>
            </>
          )
        })()}
      </Modal>

      {/* Approve Confirmation */}
      <Modal open={approveConfirm !== null} onClose={() => setApproveConfirm(null)} className="max-w-sm">
        <div className="flex flex-col items-center gap-4 p-6 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500/10">
            <CheckCircle className="h-6 w-6 text-emerald-600" />
          </div>
          <h3 className="text-base font-semibold text-foreground">{t("admin.txidApproveConfirm")}</h3>
          <p className="text-sm text-muted-foreground">{t("admin.txidApproveHint")}</p>
          <div className="flex w-full gap-3">
            <button
              type="button"
              className="flex-1 rounded-lg border border-input bg-transparent px-4 py-2 text-sm font-medium text-foreground hover:bg-accent transition-colors"
              onClick={() => setApproveConfirm(null)}
            >
              {t("admin.cancel")}
            </button>
            <button
              type="button"
              disabled={actionLoading}
              className="flex-1 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 transition-colors disabled:opacity-50"
              onClick={() => { if (approveConfirm) handleApprove(approveConfirm) }}
            >
              {actionLoading ? t("admin.txidProcessing") : t("admin.txidApproveBtn")}
            </button>
          </div>
        </div>
      </Modal>

      {/* Reject Confirmation */}
      <Modal open={rejectConfirm !== null} onClose={() => setRejectConfirm(null)} className="max-w-sm">
        <div className="flex flex-col items-center gap-4 p-6 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-red-500/10">
            <XCircle className="h-6 w-6 text-red-600" />
          </div>
          <h3 className="text-base font-semibold text-foreground">{t("admin.txidRejectConfirm")}</h3>
          <textarea
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            placeholder={t("admin.txidRejectReasonPlaceholder")}
            className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring resize-none text-left"
            rows={2}
          />
          <div className="flex w-full gap-3">
            <button
              type="button"
              className="flex-1 rounded-lg border border-input bg-transparent px-4 py-2 text-sm font-medium text-foreground hover:bg-accent transition-colors"
              onClick={() => setRejectConfirm(null)}
            >
              {t("admin.cancel")}
            </button>
            <button
              type="button"
              disabled={actionLoading}
              className="flex-1 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 transition-colors disabled:opacity-50"
              onClick={() => { if (rejectConfirm) handleReject(rejectConfirm) }}
            >
              {actionLoading ? t("admin.txidProcessing") : t("admin.txidRejectBtn")}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
