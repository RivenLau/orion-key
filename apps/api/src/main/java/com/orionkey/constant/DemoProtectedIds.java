package com.orionkey.constant;

import com.orionkey.exception.BusinessException;

import java.util.Set;
import java.util.UUID;

/**
 * Demo 分支专用：受保护的样例数据 ID 白名单。
 * 合并到 main 分支前请整体删除本类及其调用点。
 */
public final class DemoProtectedIds {

    private DemoProtectedIds() {}

    public static final String DEMO_FORBIDDEN_MESSAGE = "demo样例数据暂不支持操作";

    /** 单次下单数量上限（直购 quantity / 购物车 OrderItem.quantity 总和）。 */
    public static final int MAX_ORDER_QUANTITY = 2;

    public static final Set<UUID> CATEGORY_IDS = Set.of(
            UUID.fromString("02b649fb-1098-4b3d-b565-204ce74fd87d"),
            UUID.fromString("fcbdbd45-4387-4ccb-b853-d6cd3ea44fba"),
            UUID.fromString("a1d24f7b-ab82-4576-ad16-659cbde2e87d"),
            UUID.fromString("ccbd6232-1e7d-4b5b-bcb3-7a61ba59fc7a")
    );

    public static final Set<UUID> PRODUCT_IDS = Set.of(
            UUID.fromString("92a543ad-3ac9-4226-b162-c2e3cacfbccf"),
            UUID.fromString("656e9514-fa04-4a12-a3a3-e949726c0526"),
            UUID.fromString("dce8a4cc-405e-47c4-aafb-688173843b92"),
            UUID.fromString("855a51cb-4494-43c9-ab5c-bcdffc239143")
    );

    public static final Set<UUID> USER_IDS = Set.of(
            UUID.fromString("baff18c5-6041-4672-9539-a7ba8df26891"),
            UUID.fromString("82231afc-fcca-4c5e-aa58-224c5c3222c6")
    );

    public static final Set<UUID> PAYMENT_CHANNEL_IDS = Set.of(
            UUID.fromString("d4cfb4a9-9962-4128-8d82-0125cf68a5ca"),
            UUID.fromString("5597cdd4-6fcd-40fc-9999-6151b05a155f"),
            UUID.fromString("3f72a7f9-7b0b-4505-af90-5e47ab5a18f6"),
            UUID.fromString("c09e1892-e0e0-49e8-8383-58b95eb15d1d")
    );

    public static boolean isProtectedCategory(UUID id) {
        return id != null && CATEGORY_IDS.contains(id);
    }

    public static boolean isProtectedProduct(UUID id) {
        return id != null && PRODUCT_IDS.contains(id);
    }

    public static boolean isProtectedUser(UUID id) {
        return id != null && USER_IDS.contains(id);
    }

    public static boolean isProtectedPaymentChannel(UUID id) {
        return id != null && PAYMENT_CHANNEL_IDS.contains(id);
    }

    public static void denyIfProtectedCategory(UUID id) {
        if (isProtectedCategory(id)) throw demoForbidden();
    }

    public static void denyIfProtectedProduct(UUID id) {
        if (isProtectedProduct(id)) throw demoForbidden();
    }

    public static void denyIfProtectedUser(UUID id) {
        if (isProtectedUser(id)) throw demoForbidden();
    }

    public static void denyIfProtectedPaymentChannel(UUID id) {
        if (isProtectedPaymentChannel(id)) throw demoForbidden();
    }

    public static void denyAlways() {
        throw demoForbidden();
    }

    private static BusinessException demoForbidden() {
        return new BusinessException(ErrorCode.DEMO_OPERATION_FORBIDDEN, DEMO_FORBIDDEN_MESSAGE);
    }
}
