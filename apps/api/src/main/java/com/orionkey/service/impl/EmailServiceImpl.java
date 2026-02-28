package com.orionkey.service.impl;

import com.orionkey.entity.CardKey;
import com.orionkey.entity.Order;
import com.orionkey.entity.OrderItem;
import com.orionkey.repository.CardKeyRepository;
import com.orionkey.repository.OrderItemRepository;
import com.orionkey.repository.OrderRepository;
import com.orionkey.repository.SiteConfigRepository;
import com.orionkey.service.EmailService;
import jakarta.mail.MessagingException;
import jakarta.mail.internet.MimeMessage;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.mail.javamail.MimeMessageHelper;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.*;
import java.util.stream.Collectors;

@Slf4j
@Service
@RequiredArgsConstructor
public class EmailServiceImpl implements EmailService {

    private final JavaMailSender mailSender;
    private final OrderRepository orderRepository;
    private final OrderItemRepository orderItemRepository;
    private final CardKeyRepository cardKeyRepository;
    private final SiteConfigRepository siteConfigRepository;

    @Value("${mail.enabled:false}")
    private boolean mailEnabled;

    @Value("${mail.site-url:https://orionkey.shop}")
    private String siteUrl;

    @Value("${spring.mail.username:}")
    private String fromAddress;

    private static final DateTimeFormatter DATE_FMT = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss");

    @Async
    @Override
    public void sendDeliveryEmail(UUID orderId) {
        if (!mailEnabled) {
            return;
        }

        try {
            Order order = orderRepository.findById(orderId).orElse(null);
            if (order == null || order.getEmail() == null || order.getEmail().isBlank()) {
                log.warn("Cannot send delivery email: order {} not found or no email", orderId);
                return;
            }

            List<OrderItem> items = orderItemRepository.findByOrderId(orderId);
            List<CardKey> keys = cardKeyRepository.findByOrderId(orderId);
            Map<UUID, OrderItem> itemMap = items.stream()
                    .collect(Collectors.toMap(OrderItem::getId, i -> i));
            Map<UUID, List<CardKey>> grouped = keys.stream()
                    .filter(k -> k.getOrderItemId() != null)
                    .collect(Collectors.groupingBy(CardKey::getOrderItemId));

            String siteName = siteConfigRepository.findByConfigKey("site_name")
                    .map(c -> c.getConfigValue())
                    .orElse("Orion Key");

            String html = buildHtml(order, itemMap, grouped, siteName);

            MimeMessage message = mailSender.createMimeMessage();
            MimeMessageHelper helper = new MimeMessageHelper(message, true, "UTF-8");
            helper.setFrom(fromAddress);
            helper.setTo(order.getEmail());
            helper.setSubject("【" + siteName + "】订单发货通知 - " + orderId.toString().substring(0, 8));
            helper.setText(html, true);

            mailSender.send(message);
            log.info("Delivery email sent for order {} to {}", orderId, order.getEmail());
        } catch (MessagingException e) {
            log.error("Failed to send delivery email for order {}: {}", orderId, e.getMessage(), e);
        } catch (Exception e) {
            log.error("Unexpected error sending delivery email for order {}: {}", orderId, e.getMessage(), e);
        }
    }

    private String buildHtml(Order order, Map<UUID, OrderItem> itemMap,
                             Map<UUID, List<CardKey>> grouped, String siteName) {
        UUID orderId = order.getId();
        BigDecimal amount = order.getActualAmount() != null ? order.getActualAmount() : order.getTotalAmount();
        LocalDateTime createdAt = order.getCreatedAt();
        String orderUrl = siteUrl + "/order/query?orderId=" + orderId;

        StringBuilder sb = new StringBuilder();
        sb.append("<!DOCTYPE html>");
        sb.append("<html lang=\"zh-CN\"><head><meta charset=\"UTF-8\">");
        sb.append("<meta name=\"viewport\" content=\"width=device-width,initial-scale=1.0\">");
        sb.append("</head><body style=\"margin:0;padding:0;background-color:#f4f4f7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;\">");

        // Container
        sb.append("<table role=\"presentation\" width=\"100%\" cellpadding=\"0\" cellspacing=\"0\" style=\"background-color:#f4f4f7;padding:24px 0;\">");
        sb.append("<tr><td align=\"center\">");
        sb.append("<table role=\"presentation\" width=\"600\" cellpadding=\"0\" cellspacing=\"0\" style=\"max-width:600px;width:100%;background-color:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);\">");

        // Header
        sb.append("<tr><td style=\"background:linear-gradient(135deg,#667eea 0%,#764ba2 100%);padding:32px 40px;text-align:center;\">");
        sb.append("<h1 style=\"margin:0;color:#ffffff;font-size:24px;font-weight:600;letter-spacing:1px;\">")
          .append(escapeHtml(siteName)).append("</h1>");
        sb.append("</td></tr>");

        // Title
        sb.append("<tr><td style=\"padding:32px 40px 0;\">");
        sb.append("<h2 style=\"margin:0 0 8px;color:#333333;font-size:20px;font-weight:600;\">订单发货通知</h2>");
        sb.append("<p style=\"margin:0;color:#666666;font-size:14px;line-height:1.6;\">您的订单已完成发货，以下是您购买的卡密信息：</p>");
        sb.append("</td></tr>");

        // Order info
        sb.append("<tr><td style=\"padding:24px 40px;\">");
        sb.append("<table role=\"presentation\" width=\"100%\" cellpadding=\"0\" cellspacing=\"0\" style=\"background-color:#f8f9fa;border-radius:6px;padding:16px;\">");
        sb.append("<tr><td style=\"padding:4px 16px;\"><span style=\"color:#888;font-size:13px;\">订单编号</span></td>");
        sb.append("<td style=\"padding:4px 16px;text-align:right;\"><span style=\"color:#333;font-size:13px;font-family:monospace;\">")
          .append(orderId).append("</span></td></tr>");
        sb.append("<tr><td style=\"padding:4px 16px;\"><span style=\"color:#888;font-size:13px;\">支付金额</span></td>");
        sb.append("<td style=\"padding:4px 16px;text-align:right;\"><span style=\"color:#333;font-size:13px;font-weight:600;\">¥")
          .append(amount).append("</span></td></tr>");
        if (createdAt != null) {
            sb.append("<tr><td style=\"padding:4px 16px;\"><span style=\"color:#888;font-size:13px;\">下单时间</span></td>");
            sb.append("<td style=\"padding:4px 16px;text-align:right;\"><span style=\"color:#333;font-size:13px;\">")
              .append(createdAt.format(DATE_FMT)).append("</span></td></tr>");
        }
        sb.append("</table>");
        sb.append("</td></tr>");

        // Card keys grouped by product
        sb.append("<tr><td style=\"padding:0 40px 24px;\">");
        for (Map.Entry<UUID, List<CardKey>> entry : grouped.entrySet()) {
            OrderItem item = itemMap.get(entry.getKey());
            if (item == null) continue;

            String title = escapeHtml(item.getProductTitle());
            if (item.getSpecName() != null && !item.getSpecName().isBlank()) {
                title += " <span style=\"color:#888;font-size:12px;\">[" + escapeHtml(item.getSpecName()) + "]</span>";
            }

            sb.append("<div style=\"margin-bottom:16px;border:1px solid #e8e8e8;border-radius:6px;overflow:hidden;\">");
            sb.append("<div style=\"background-color:#f0f0f5;padding:10px 16px;font-size:14px;font-weight:600;color:#333;\">")
              .append(title).append("</div>");
            sb.append("<div style=\"padding:12px 16px;\">");
            for (CardKey key : entry.getValue()) {
                sb.append("<div style=\"background-color:#fafafa;border:1px solid #eee;border-radius:4px;padding:8px 12px;margin-bottom:6px;font-family:'Courier New',Courier,monospace;font-size:13px;color:#222;word-break:break-all;\">")
                  .append(escapeHtml(key.getContent())).append("</div>");
            }
            sb.append("</div></div>");
        }
        sb.append("</td></tr>");

        // Warning
        sb.append("<tr><td style=\"padding:0 40px 24px;\">");
        sb.append("<div style=\"background-color:#fff8e1;border:1px solid #ffe082;border-radius:6px;padding:12px 16px;font-size:13px;color:#f57f17;\">");
        sb.append("&#9888; 请妥善保管卡密信息，切勿泄露给他人。如有任何问题，请联系客服。");
        sb.append("</div></td></tr>");

        // CTA button
        sb.append("<tr><td style=\"padding:0 40px 32px;text-align:center;\">");
        sb.append("<a href=\"").append(escapeHtml(orderUrl)).append("\" style=\"display:inline-block;background:linear-gradient(135deg,#667eea 0%,#764ba2 100%);color:#ffffff;text-decoration:none;padding:12px 32px;border-radius:6px;font-size:14px;font-weight:600;\">查看订单详情</a>");
        sb.append("</td></tr>");

        // Footer
        sb.append("<tr><td style=\"background-color:#f8f9fa;padding:20px 40px;text-align:center;border-top:1px solid #eee;\">");
        sb.append("<p style=\"margin:0 0 4px;color:#999;font-size:12px;\">此邮件由系统自动发送，请勿直接回复</p>");
        sb.append("<p style=\"margin:0;color:#bbb;font-size:11px;\">&copy; ").append(java.time.Year.now().getValue())
          .append(" ").append(escapeHtml(siteName)).append("</p>");
        sb.append("</td></tr>");

        sb.append("</table></td></tr></table>");
        sb.append("</body></html>");

        return sb.toString();
    }

    private static String escapeHtml(String input) {
        if (input == null) return "";
        return input.replace("&", "&amp;")
                    .replace("<", "&lt;")
                    .replace(">", "&gt;")
                    .replace("\"", "&quot;")
                    .replace("'", "&#39;");
    }
}
