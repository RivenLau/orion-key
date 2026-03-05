package com.orionkey.annotation;

import java.lang.annotation.ElementType;
import java.lang.annotation.Retention;
import java.lang.annotation.RetentionPolicy;
import java.lang.annotation.Target;

/**
 * 标记需要记录操作日志的管理员接口方法。
 * 仅在方法正常返回后记录（@AfterReturning），异常时不记录。
 */
@Target(ElementType.METHOD)
@Retention(RetentionPolicy.RUNTIME)
public @interface LogOperation {

    /** 操作标识，如 "product.create" */
    String action();

    /** 目标类型，如 "PRODUCT" */
    String targetType();

    /** SpEL 表达式提取目标 ID，如 "#id"；默认为空（不提取） */
    String targetId() default "";

    /** SpEL 表达式或字面量生成详情，如 "'创建商品'"；默认为空（切面用 action 兜底） */
    String detail() default "";
}
