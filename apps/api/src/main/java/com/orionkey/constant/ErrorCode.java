package com.orionkey.constant;

public final class ErrorCode {

    private ErrorCode() {}

    // ── 通用 10001~10099 ──
    public static final int BAD_REQUEST = 10001;
    public static final int UNAUTHORIZED = 10002;
    public static final int FORBIDDEN = 10003;
    public static final int NOT_FOUND = 10004;
    public static final int TOO_MANY_REQUESTS = 10005;
    public static final int SERVER_ERROR = 10006;
    public static final int MAINTENANCE = 10007;

    // ── Auth 20001~20099 ──
    public static final int USERNAME_EXISTS = 20001;
    public static final int EMAIL_EXISTS = 20002;
    public static final int CAPTCHA_INVALID = 20003;
    public static final int INVALID_CREDENTIALS = 20004;
    public static final int OLD_PASSWORD_WRONG = 20005;
    public static final int ACCOUNT_DISABLED = 20006;
    public static final int ACCOUNT_LOCKED = 20007;

    // ── Product 30001~30099 ──
    public static final int PRODUCT_NOT_FOUND = 30001;
    public static final int INSUFFICIENT_STOCK = 30002;
    public static final int SPEC_NOT_FOUND = 30003;
    public static final int PURCHASE_LIMIT_EXCEEDED = 30004;

    // ── Order 40001~40099 ──
    public static final int ORDER_NOT_FOUND = 40001;
    public static final int ORDER_EXPIRED = 40002;
    public static final int ORDER_NOT_PAID = 40003;
    public static final int ORDER_OUT_OF_STOCK = 40004;
    public static final int ORDER_ALREADY_DELIVERED = 40005;
    public static final int PURCHASE_LIMIT = 40006;
    public static final int UNPAID_ORDER_EXISTS = 40007;
    public static final int CART_EMPTY = 40008;

    // ── Payment 50001~50099 ──
    public static final int CHANNEL_UNAVAILABLE = 50001;
    public static final int WEBHOOK_VERIFY_FAIL = 50002;
    public static final int TXID_INVALID_FORMAT = 50003;
    public static final int TXID_ALREADY_USED = 50004;
    public static final int TXID_VERIFY_FAILED = 50005;
    public static final int ORDER_NOT_USDT = 50006;

    // ── Admin 70001~70099 ──
    public static final int CATEGORY_NAME_EXISTS = 70001;
    public static final int CATEGORY_HAS_PRODUCTS = 70002;
    public static final int CARD_KEY_FORMAT_ERROR = 70003;
    public static final int CARD_KEY_DUPLICATE = 70004;
    public static final int PAYMENT_CONFIG_INCOMPLETE = 70005;
}
