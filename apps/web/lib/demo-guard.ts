/**
 * [DEMO] 演示分支专用：受保护样例数据 ID 白名单 + 通用拒绝工具。
 * 合并到 main 分支前请整体删除本文件及调用点。
 *
 * 后端在 controller 入口已有同样校验作为兜底（错误码 90001 → error.demoForbidden）；
 * 本文件只是为了让前端能在按钮点击瞬间就给出反馈，避免无谓的网络请求。
 */
import { toast } from "sonner"

export const DEMO_FORBIDDEN_MESSAGE_ZH = "demo样例数据暂不支持操作"
export const DEMO_FORBIDDEN_MESSAGE_EN = "Demo data does not support this operation"

export const DEMO_PROTECTED_CATEGORY_IDS = new Set<string>([
  "02b649fb-1098-4b3d-b565-204ce74fd87d",
  "fcbdbd45-4387-4ccb-b853-d6cd3ea44fba",
  "a1d24f7b-ab82-4576-ad16-659cbde2e87d",
  "ccbd6232-1e7d-4b5b-bcb3-7a61ba59fc7a",
])

export const DEMO_PROTECTED_PRODUCT_IDS = new Set<string>([
  "92a543ad-3ac9-4226-b162-c2e3cacfbccf",
  "656e9514-fa04-4a12-a3a3-e949726c0526",
  "dce8a4cc-405e-47c4-aafb-688173843b92",
  "855a51cb-4494-43c9-ab5c-bcdffc239143",
])

export const DEMO_PROTECTED_USER_IDS = new Set<string>([
  "baff18c5-6041-4672-9539-a7ba8df26891",
  "82231afc-fcca-4c5e-aa58-224c5c3222c6",
])

export const DEMO_PROTECTED_PAYMENT_CHANNEL_IDS = new Set<string>([
  "d4cfb4a9-9962-4128-8d82-0125cf68a5ca",
  "5597cdd4-6fcd-40fc-9999-6151b05a155f",
  "3f72a7f9-7b0b-4505-af90-5e47ab5a18f6",
  "c09e1892-e0e0-49e8-8383-58b95eb15d1d",
])

export const DEMO_MAX_ORDER_QUANTITY = 2

function normalize(id: string | null | undefined): string {
  return (id || "").toLowerCase()
}

export function isDemoProtectedCategory(id: string | null | undefined): boolean {
  const v = normalize(id)
  return !!v && DEMO_PROTECTED_CATEGORY_IDS.has(v)
}

export function isDemoProtectedProduct(id: string | null | undefined): boolean {
  const v = normalize(id)
  return !!v && DEMO_PROTECTED_PRODUCT_IDS.has(v)
}

export function isDemoProtectedUser(id: string | null | undefined): boolean {
  const v = normalize(id)
  return !!v && DEMO_PROTECTED_USER_IDS.has(v)
}

export function isDemoProtectedPaymentChannel(id: string | null | undefined): boolean {
  const v = normalize(id)
  return !!v && DEMO_PROTECTED_PAYMENT_CHANNEL_IDS.has(v)
}

/**
 * 弹出拒绝提示。
 * @param locale 当前语言；不传则默认中文。t 函数可选，传入则优先使用 i18n key。
 * @returns 始终返回 false，方便调用方写 `if (denyDemoOperation()) return`。
 */
export function denyDemoOperation(opts?: {
  locale?: "zh" | "en"
  t?: (key: "error.demoForbidden") => string
}): false {
  const message = opts?.t
    ? opts.t("error.demoForbidden")
    : opts?.locale === "en"
      ? DEMO_FORBIDDEN_MESSAGE_EN
      : DEMO_FORBIDDEN_MESSAGE_ZH
  toast.error(message)
  return false
}
