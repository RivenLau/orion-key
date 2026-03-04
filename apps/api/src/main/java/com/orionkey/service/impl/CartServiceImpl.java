package com.orionkey.service.impl;

import com.orionkey.constant.CardKeyStatus;
import com.orionkey.constant.ErrorCode;
import com.orionkey.entity.CartItem;
import com.orionkey.entity.Product;
import com.orionkey.entity.ProductSpec;
import com.orionkey.exception.BusinessException;
import com.orionkey.repository.CardKeyRepository;
import com.orionkey.repository.CartItemRepository;
import com.orionkey.repository.ProductRepository;
import com.orionkey.repository.ProductSpecRepository;
import com.orionkey.service.CartService;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.util.*;

@Service
@RequiredArgsConstructor
public class CartServiceImpl implements CartService {

    private final CartItemRepository cartItemRepository;
    private final ProductRepository productRepository;
    private final ProductSpecRepository productSpecRepository;
    private final CardKeyRepository cardKeyRepository;

    @Override
    @Transactional
    public Map<String, Object> getCart(UUID userId, String sessionToken) {
        // 登录用户且有游客 sessionToken → 合并游客购物车到用户账户
        if (userId != null && sessionToken != null) {
            mergeGuestCart(userId, sessionToken);
        }

        List<CartItem> items;
        if (userId != null) {
            items = cartItemRepository.findByUserId(userId);
        } else if (sessionToken != null) {
            items = cartItemRepository.findBySessionToken(sessionToken);
        } else {
            items = List.of();
        }

        BigDecimal totalAmount = BigDecimal.ZERO;
        List<Map<String, Object>> itemList = new ArrayList<>();
        for (CartItem item : items) {
            Map<String, Object> m = toCartItemMap(item);
            BigDecimal subtotal = (BigDecimal) m.get("subtotal");
            totalAmount = totalAmount.add(subtotal);
            itemList.add(m);
        }

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("items", itemList);
        result.put("total_amount", totalAmount);
        return result;
    }

    @Override
    @Transactional
    public String addItem(UUID userId, String sessionToken, Map<String, Object> req) {
        UUID productId = UUID.fromString((String) req.get("product_id"));
        UUID specId = req.get("spec_id") != null ? UUID.fromString((String) req.get("spec_id")) : null;
        int quantity = ((Number) req.get("quantity")).intValue();

        Product product = productRepository.findById(productId)
                .filter(p -> p.getIsDeleted() == 0 && p.isEnabled())
                .orElseThrow(() -> new BusinessException(ErrorCode.PRODUCT_NOT_FOUND, "商品不存在或已下架"));

        // Generate session token for guest
        String resultSessionToken = sessionToken;
        if (userId == null && resultSessionToken == null) {
            resultSessionToken = UUID.randomUUID().toString();
        }

        // Check existing cart item
        Optional<CartItem> existing;
        if (userId != null) {
            existing = cartItemRepository.findByUserIdAndProductIdAndSpecId(userId, productId, specId);
        } else {
            existing = cartItemRepository.findBySessionTokenAndProductIdAndSpecId(resultSessionToken, productId, specId);
        }

        // Advisory stock check: 购物车已有数量 + 新增数量 ≤ 可用库存
        int existingQty = existing.map(CartItem::getQuantity).orElse(0);
        int totalQty = existingQty + quantity;
        long available = specId != null
                ? cardKeyRepository.countByProductIdAndSpecIdAndStatus(productId, specId, CardKeyStatus.AVAILABLE)
                : cardKeyRepository.countByProductIdAndSpecIdIsNullAndStatus(productId, CardKeyStatus.AVAILABLE);
        if (totalQty > available) {
            throw new BusinessException(ErrorCode.INSUFFICIENT_STOCK,
                    "该商品库存不足，最多可购买 " + available + " 件",
                    Map.of("available", available));
        }

        if (existing.isPresent()) {
            existing.get().setQuantity(totalQty);
            cartItemRepository.save(existing.get());
        } else {
            CartItem item = new CartItem();
            item.setUserId(userId);
            item.setSessionToken(userId == null ? resultSessionToken : null);
            item.setProductId(productId);
            item.setSpecId(specId);
            item.setQuantity(quantity);
            cartItemRepository.save(item);
        }

        return resultSessionToken;
    }

    @Override
    @Transactional
    public void updateItem(UUID userId, String sessionToken, UUID itemId, int quantity) {
        CartItem item = cartItemRepository.findById(itemId)
                .orElseThrow(() -> new BusinessException(ErrorCode.NOT_FOUND, "购物车项不存在"));
        verifyOwnership(item, userId, sessionToken);

        // Advisory stock check
        long available = item.getSpecId() != null
                ? cardKeyRepository.countByProductIdAndSpecIdAndStatus(item.getProductId(), item.getSpecId(), CardKeyStatus.AVAILABLE)
                : cardKeyRepository.countByProductIdAndSpecIdIsNullAndStatus(item.getProductId(), CardKeyStatus.AVAILABLE);
        if (quantity > available) {
            throw new BusinessException(ErrorCode.INSUFFICIENT_STOCK,
                    "该商品库存不足，最多可购买 " + available + " 件",
                    Map.of("available", available));
        }

        item.setQuantity(quantity);
        cartItemRepository.save(item);
    }

    @Override
    @Transactional
    public void deleteItem(UUID userId, String sessionToken, UUID itemId) {
        CartItem item = cartItemRepository.findById(itemId)
                .orElseThrow(() -> new BusinessException(ErrorCode.NOT_FOUND, "购物车项不存在"));
        verifyOwnership(item, userId, sessionToken);
        cartItemRepository.delete(item);
    }

    private void verifyOwnership(CartItem item, UUID userId, String sessionToken) {
        if (userId != null && userId.equals(item.getUserId())) return;
        if (sessionToken != null && sessionToken.equals(item.getSessionToken())) return;
        throw new BusinessException(ErrorCode.FORBIDDEN, "无权操作此购物车项");
    }

    /**
     * 将游客购物车（sessionToken）合并到登录用户（userId）。
     * 相同商品+规格的项合并数量，其余直接迁移归属。
     */
    private void mergeGuestCart(UUID userId, String sessionToken) {
        List<CartItem> guestItems = cartItemRepository.findBySessionToken(sessionToken);
        if (guestItems.isEmpty()) return;

        for (CartItem guestItem : guestItems) {
            Optional<CartItem> existing = cartItemRepository.findByUserIdAndProductIdAndSpecId(
                    userId, guestItem.getProductId(), guestItem.getSpecId());
            if (existing.isPresent()) {
                // 已存在同商品+规格 → 合并数量
                existing.get().setQuantity(existing.get().getQuantity() + guestItem.getQuantity());
                cartItemRepository.save(existing.get());
                cartItemRepository.delete(guestItem);
            } else {
                // 不存在 → 迁移归属
                guestItem.setUserId(userId);
                guestItem.setSessionToken(null);
                cartItemRepository.save(guestItem);
            }
        }
    }

    private Map<String, Object> toCartItemMap(CartItem item) {
        Map<String, Object> map = new LinkedHashMap<>();
        map.put("id", item.getId());
        map.put("product_id", item.getProductId());
        map.put("spec_id", item.getSpecId());

        Product product = productRepository.findById(item.getProductId()).orElse(null);
        String productTitle = product != null ? product.getTitle() : "未知商品";
        String coverUrl = product != null ? product.getCoverUrl() : null;
        BigDecimal unitPrice = product != null ? product.getBasePrice() : BigDecimal.ZERO;

        String specName = null;
        if (item.getSpecId() != null) {
            ProductSpec spec = productSpecRepository.findById(item.getSpecId()).orElse(null);
            if (spec != null) {
                specName = spec.getName();
                unitPrice = spec.getPrice();
            }
        }

        map.put("product_title", productTitle);
        map.put("spec_name", specName);
        map.put("cover_url", coverUrl);
        map.put("currency", product != null ? product.getCurrency() : "CNY");
        map.put("unit_price", unitPrice);
        map.put("quantity", item.getQuantity());
        map.put("subtotal", unitPrice.multiply(BigDecimal.valueOf(item.getQuantity())));

        long stockAvailable = item.getSpecId() != null
                ? cardKeyRepository.countByProductIdAndSpecIdAndStatus(item.getProductId(), item.getSpecId(), CardKeyStatus.AVAILABLE)
                : cardKeyRepository.countByProductIdAndSpecIdIsNullAndStatus(item.getProductId(), CardKeyStatus.AVAILABLE);
        map.put("stock_available", stockAvailable);

        return map;
    }
}
