"use client"

import { useState, useEffect } from "react"
import { ChevronDown, ChevronLeft, ChevronRight, Eye, CheckCircle, XCircle, X, ExternalLink } from "lucide-react"
import { cn } from "@/lib/utils"
import { useLocale } from "@/lib/context"
import { toast } from "sonner"
import { adminTxidReviewApi, withMockFallback } from "@/services/api"
import { Modal } from "@/components/ui/modal"
import type { UnmatchedTransaction, TxidReviewStatus } from "@/types"

const ITEMS_PER_PAGE = 10

const STATUS_OPTIONS: { value: TxidReviewStatus | ""; label: string; labelEn: string }[] = [
  { value: "", label: "全部状态", labelEn: "All Status" },
  { value: "PENDING_REVIEW", label: "待审核", labelEn: "Pending Review" },
  { value: "AUTO_APPROVED", label: "自动通过", labelEn: "Auto Approved" },
  { value: "AUTO_REJECTED", label: "自动拒绝", labelEn: "Auto Rejected" },
  { value: "APPROVED", label: "人工通过", labelEn: "Approved" },
  { value: "REJECTED", label: "人工拒绝", labelEn: "Rejected" },
]

function statusBadge(status: TxidReviewStatus) {
  const map: Record<TxidReviewStatus, { bg: string; text: string; label: string }> = {
    PENDING_REVIEW: { bg: "bg-amber-500/10", text: "text-amber-600", label: "待审核" },
    AUTO_APPROVED: { bg: "bg-emerald-500/10", text: "text-emerald-600", label: "自动通过" },
    AUTO_REJECTED: { bg: "bg-red-500/10", text: "text-red-600", label: "自动拒绝" },
    APPROVED: { bg: "bg-emerald-500/10", text: "text-emerald-600", label: "人工通过" },
    REJECTED: { bg: "bg-red-500/10", text: "text-red-600", label: "人工拒绝" },
  }
  const s = map[status] || { bg: "bg-muted", text: "text-muted-foreground", label: status }
  return (
    <span className={cn("rounded-full px-2.5 py-0.5 text-xs font-medium", s.bg, s.text)}>
      {s.label}
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
      toast.success("已通过审核，订单将自动核销")
      setShowDetail(null)
      await fetchList()
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "操作失败")
    } finally {
      setActionLoading(false)
    }
  }

  const handleReject = async (record: UnmatchedTransaction) => {
    if (!rejectReason.trim()) {
      toast.error("请填写拒绝原因")
      return
    }
    setActionLoading(true)
    try {
      await withMockFallback(
        () => adminTxidReviewApi.reject(record.id, rejectReason.trim()),
        () => null
      )
      toast.success("已拒绝")
      setRejectReason("")
      setShowDetail(null)
      await fetchList()
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "操作失败")
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
        <p className="text-sm text-muted-foreground">管理 USDT 交易哈希审核记录，仅 PENDING_REVIEW 状态可操作</p>
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
              <option key={opt.value} value={opt.value}>{opt.label}</option>
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
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">订单号</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">TXID</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">链</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">预期金额</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">链上金额</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">差额</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">来源</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">状态</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">提交时间</th>
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
                  <td colSpan={10} className="py-8 text-center text-sm text-muted-foreground">暂无审核记录</td>
                </tr>
              ) : (
                records.map((record) => {
                  const explorerUrl = txidExplorerUrl(record.txid, record.chain)
                  return (
                    <tr key={record.id} className="border-b border-border/50 last:border-0 hover:bg-muted/20 transition-colors">
                      <td className="px-4 py-3">
                        <span className="font-mono text-xs font-medium text-foreground">
                          {shortenId(record.order_id)}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1">
                          <span className="font-mono text-xs text-foreground" title={record.txid}>
                            {shortenTxid(record.txid)}
                          </span>
                          {explorerUrl && (
                            <a
                              href={explorerUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-muted-foreground hover:text-primary transition-colors"
                              title="在区块浏览器中查看"
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
                          {record.source === "USER_SUBMIT" ? "用户提交" : "回调异常"}
                        </span>
                      </td>
                      <td className="px-4 py-3">{statusBadge(record.status)}</td>
                      <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">
                        {new Date(record.submitted_at || record.created_at).toLocaleString()}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            type="button"
                            onClick={() => openDetail(record)}
                            className="rounded-md p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
                            title="查看详情"
                          >
                            <Eye className="h-4 w-4" />
                          </button>
                          {record.status === "PENDING_REVIEW" && (
                            <>
                              <button
                                type="button"
                                onClick={() => handleApprove(record)}
                                className="rounded-md p-1.5 text-muted-foreground hover:bg-emerald-500/10 hover:text-emerald-600 transition-colors"
                                title="通过"
                              >
                                <CheckCircle className="h-4 w-4" />
                              </button>
                              <button
                                type="button"
                                onClick={() => openDetail(record)}
                                className="rounded-md p-1.5 text-muted-foreground hover:bg-red-500/10 hover:text-red-600 transition-colors"
                                title="拒绝"
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
                  <h2 className="text-lg font-semibold text-foreground">TXID 审核详情</h2>
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
                <div className="grid grid-cols-2 gap-x-8 gap-y-4">
                  <div className="flex flex-col gap-1">
                    <span className="text-xs text-muted-foreground">关联订单</span>
                    <span className="font-mono text-sm font-medium text-foreground">{shortenId(showDetail.order_id)}</span>
                  </div>
                  <div className="flex flex-col gap-1">
                    <span className="text-xs text-muted-foreground">链</span>
                    <span className="text-sm text-foreground">{chainLabel(showDetail.chain)}</span>
                  </div>
                  <div className="col-span-2 flex flex-col gap-1">
                    <span className="text-xs text-muted-foreground">TXID</span>
                    <div className="flex items-center gap-2">
                      <code className="break-all rounded bg-muted/50 px-2 py-1 text-xs text-foreground">{showDetail.txid}</code>
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
                    <span className="text-xs text-muted-foreground">预期金额</span>
                    <span className="text-sm font-medium text-foreground">{showDetail.expected_amount} USDT</span>
                  </div>
                  <div className="flex flex-col gap-1">
                    <span className="text-xs text-muted-foreground">链上金额</span>
                    <span className="text-sm font-medium text-foreground">
                      {showDetail.on_chain_amount != null ? `${showDetail.on_chain_amount} USDT` : "未获取"}
                    </span>
                  </div>
                  {showDetail.amount_diff != null && (
                    <div className="flex flex-col gap-1">
                      <span className="text-xs text-muted-foreground">金额差异</span>
                      <span className={cn(
                        "text-sm font-medium",
                        showDetail.amount_diff === 0 ? "text-emerald-600" :
                        Math.abs(showDetail.amount_diff) < 1 ? "text-amber-600" : "text-red-600"
                      )}>
                        {showDetail.amount_diff > 0 ? "+" : ""}{showDetail.amount_diff} USDT
                      </span>
                    </div>
                  )}
                  <div className="flex flex-col gap-1">
                    <span className="text-xs text-muted-foreground">来源</span>
                    <span className="text-sm text-foreground">
                      {showDetail.source === "USER_SUBMIT" ? "用户提交" : "回调异常"}
                    </span>
                  </div>
                  {showDetail.on_chain_from && (
                    <div className="col-span-2 flex flex-col gap-1">
                      <span className="text-xs text-muted-foreground">发送地址</span>
                      <code className="break-all text-xs text-foreground">{showDetail.on_chain_from}</code>
                    </div>
                  )}
                  {showDetail.on_chain_to && (
                    <div className="col-span-2 flex flex-col gap-1">
                      <span className="text-xs text-muted-foreground">接收地址</span>
                      <code className="break-all text-xs text-foreground">{showDetail.on_chain_to}</code>
                    </div>
                  )}
                  <div className="flex flex-col gap-1">
                    <span className="text-xs text-muted-foreground">状态</span>
                    {statusBadge(showDetail.status)}
                  </div>
                  {showDetail.verify_reason && (
                    <div className="col-span-2 flex flex-col gap-1">
                      <span className="text-xs text-muted-foreground">验证/审核说明</span>
                      <span className="text-sm text-foreground">{showDetail.verify_reason}</span>
                    </div>
                  )}
                  <div className="flex flex-col gap-1">
                    <span className="text-xs text-muted-foreground">提交时间</span>
                    <span className="text-sm text-foreground">
                      {new Date(showDetail.submitted_at || showDetail.created_at).toLocaleString()}
                    </span>
                  </div>
                  {showDetail.reviewed_at && (
                    <div className="flex flex-col gap-1">
                      <span className="text-xs text-muted-foreground">审核时间</span>
                      <span className="text-sm text-foreground">{new Date(showDetail.reviewed_at).toLocaleString()}</span>
                    </div>
                  )}
                </div>

                {/* Reject reason input — only for PENDING_REVIEW */}
                {showDetail.status === "PENDING_REVIEW" && (
                  <div className="flex flex-col gap-2">
                    <label className="text-xs text-muted-foreground">拒绝原因（拒绝时必填）</label>
                    <textarea
                      value={rejectReason}
                      onChange={(e) => setRejectReason(e.target.value)}
                      placeholder="请输入拒绝原因..."
                      className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring resize-none"
                      rows={2}
                    />
                  </div>
                )}
              </div>
              <div className="flex justify-end gap-3 border-t border-border px-6 py-4">
                {showDetail.status === "PENDING_REVIEW" && (
                  <>
                    <button
                      type="button"
                      disabled={actionLoading}
                      className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 transition-colors disabled:opacity-50"
                      onClick={() => handleApprove(showDetail)}
                    >
                      {actionLoading ? "处理中..." : "通过"}
                    </button>
                    <button
                      type="button"
                      disabled={actionLoading}
                      className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 transition-colors disabled:opacity-50"
                      onClick={() => handleReject(showDetail)}
                    >
                      {actionLoading ? "处理中..." : "拒绝"}
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
    </div>
  )
}
