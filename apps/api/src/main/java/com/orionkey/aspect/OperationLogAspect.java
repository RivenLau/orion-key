package com.orionkey.aspect;

import com.orionkey.annotation.LogOperation;
import com.orionkey.context.RequestContext;
import com.orionkey.service.OperationLogService;
import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.aspectj.lang.JoinPoint;
import org.aspectj.lang.annotation.AfterReturning;
import org.aspectj.lang.annotation.Aspect;
import org.aspectj.lang.reflect.MethodSignature;
import org.springframework.expression.EvaluationContext;
import org.springframework.expression.ExpressionParser;
import org.springframework.expression.spel.standard.SpelExpressionParser;
import org.springframework.expression.spel.support.StandardEvaluationContext;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;
import org.springframework.web.context.request.RequestContextHolder;
import org.springframework.web.context.request.ServletRequestAttributes;

import java.util.UUID;

@Slf4j
@Aspect
@Component
@RequiredArgsConstructor
public class OperationLogAspect {

    private final OperationLogService operationLogService;
    private final ExpressionParser parser = new SpelExpressionParser();

    @AfterReturning(pointcut = "@annotation(logOp)", returning = "result")
    public void afterReturning(JoinPoint joinPoint, LogOperation logOp, Object result) {
        try {
            // 获取当前用户
            UUID userId = RequestContext.getUserId();
            RequestContext.UserInfo userInfo = RequestContext.get();
            String username = userInfo != null ? userInfo.getUsername() : "unknown";

            // 获取客户端 IP
            String ip = resolveClientIp();

            // 构建 SpEL 上下文
            EvaluationContext ctx = buildEvaluationContext(joinPoint, result);

            // 解析 targetId
            String targetId = evaluateSpel(logOp.targetId(), ctx);

            // 解析 detail，为空则用 action 兜底
            String detail = evaluateSpel(logOp.detail(), ctx);
            if (!StringUtils.hasText(detail)) {
                detail = logOp.action();
            }

            operationLogService.log(userId, username, logOp.action(),
                    logOp.targetType(), targetId, detail, ip);
        } catch (Exception e) {
            // 日志写入失败不影响业务
            log.warn("Failed to record operation log for {}: {}", logOp.action(), e.getMessage());
        }
    }

    private EvaluationContext buildEvaluationContext(JoinPoint joinPoint, Object result) {
        StandardEvaluationContext ctx = new StandardEvaluationContext();
        MethodSignature signature = (MethodSignature) joinPoint.getSignature();
        String[] paramNames = signature.getParameterNames();
        Object[] args = joinPoint.getArgs();
        if (paramNames != null) {
            for (int i = 0; i < paramNames.length; i++) {
                ctx.setVariable(paramNames[i], args[i]);
            }
        }
        ctx.setVariable("result", result);
        return ctx;
    }

    private String evaluateSpel(String expression, EvaluationContext ctx) {
        if (!StringUtils.hasText(expression)) {
            return null;
        }
        try {
            Object value = parser.parseExpression(expression).getValue(ctx);
            return value != null ? value.toString() : null;
        } catch (Exception e) {
            log.debug("SpEL evaluation failed for '{}': {}", expression, e.getMessage());
            return null;
        }
    }

    private String resolveClientIp() {
        ServletRequestAttributes attrs =
                (ServletRequestAttributes) RequestContextHolder.getRequestAttributes();
        if (attrs == null) {
            return "unknown";
        }
        HttpServletRequest request = attrs.getRequest();
        String xff = request.getHeader("X-Forwarded-For");
        if (StringUtils.hasText(xff)) {
            return xff.split(",")[0].trim();
        }
        String realIp = request.getHeader("X-Real-IP");
        if (StringUtils.hasText(realIp)) {
            return realIp.trim();
        }
        return request.getRemoteAddr();
    }
}
