package com.orionkey.service.impl;

import com.orionkey.common.PageResult;
import com.orionkey.constant.CardKeyStatus;
import com.orionkey.constant.ErrorCode;
import com.orionkey.entity.Product;
import com.orionkey.entity.ProductSpec;
import com.orionkey.entity.WholesaleRule;
import com.orionkey.exception.BusinessException;
import com.orionkey.repository.CardKeyRepository;
import com.orionkey.repository.OrderItemRepository;
import com.orionkey.repository.ProductRepository;
import com.orionkey.repository.ProductSpecRepository;
import com.orionkey.repository.WholesaleRuleRepository;
import com.orionkey.service.ProductService;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.util.*;

@Service
@RequiredArgsConstructor
public class ProductServiceImpl implements ProductService {

    private final ProductRepository productRepository;
    private final ProductSpecRepository productSpecRepository;
    private final WholesaleRuleRepository wholesaleRuleRepository;
    private final CardKeyRepository cardKeyRepository;
    private final OrderItemRepository orderItemRepository;

    @Override
    public PageResult<?> listPublicProducts(UUID categoryId, String keyword, int page, int pageSize) {
        var pageable = PageRequest.of(page - 1, pageSize,
                Sort.by("sortOrder").ascending().and(Sort.by("createdAt").descending()));
        Page<Product> productPage;
        if (keyword != null && !keyword.isBlank()) {
            productPage = productRepository.findPublicProductsByKeyword(categoryId, "%" + keyword.toLowerCase() + "%", pageable);
        } else {
            productPage = productRepository.findPublicProducts(categoryId, pageable);
        }
        var list = productPage.getContent().stream().map(this::toProductCard).toList();
        return PageResult.of(productPage, list);
    }

    @Override
    public Map<String, Object> getProductDetail(UUID id) {
        Product product = productRepository.findById(id)
                .filter(p -> p.getIsDeleted() == 0 && p.isEnabled())
                .orElseThrow(() -> new BusinessException(ErrorCode.PRODUCT_NOT_FOUND, "商品不存在或已下架"));
        return toProductDetail(product);
    }

    @Override
    public Map<String, Object> getAdminProductDetail(UUID id) {
        Product product = productRepository.findById(id)
                .filter(p -> p.getIsDeleted() == 0)
                .orElseThrow(() -> new BusinessException(ErrorCode.PRODUCT_NOT_FOUND, "商品不存在"));
        Map<String, Object> detail = toProductDetail(product);
        detail.put("is_enabled", product.isEnabled());
        detail.put("sort_order", product.getSortOrder());
        detail.put("low_stock_threshold", product.getLowStockThreshold());
        detail.put("created_at", product.getCreatedAt());
        detail.put("updated_at", product.getUpdatedAt());
        return detail;
    }

    @Override
    public PageResult<?> listAdminProducts(UUID categoryId, String keyword, Boolean isEnabled, int page, int pageSize) {
        var pageable = PageRequest.of(page - 1, pageSize, Sort.by("sortOrder").ascending());
        Page<Product> productPage;
        if (keyword != null && !keyword.isBlank()) {
            productPage = productRepository.findAdminProductsByKeyword(categoryId, "%" + keyword.toLowerCase() + "%", isEnabled, pageable);
        } else {
            productPage = productRepository.findAdminProducts(categoryId, isEnabled, pageable);
        }
        var list = productPage.getContent().stream().map(p -> {
            Map<String, Object> detail = toProductDetail(p);
            detail.put("is_enabled", p.isEnabled());
            detail.put("sort_order", p.getSortOrder());
            detail.put("low_stock_threshold", p.getLowStockThreshold());
            detail.put("sales_count", orderItemRepository.sumQuantityByProductId(p.getId()));
            detail.put("created_at", p.getCreatedAt());
            detail.put("updated_at", p.getUpdatedAt());
            return detail;
        }).toList();
        return PageResult.of(productPage, list);
    }

    @Override
    @Transactional
    public Map<String, Object> createProduct(Map<String, Object> req) {
        Product product = new Product();
        product.setTitle((String) req.get("title"));
        product.setDescription((String) req.get("description"));
        product.setDetailMd((String) req.get("detail_md"));
        product.setCoverUrl((String) req.get("cover_url"));
        product.setBasePrice(new BigDecimal(req.get("base_price").toString()));
        if (req.containsKey("currency")) product.setCurrency((String) req.get("currency"));
        if (req.containsKey("delivery_type")) product.setDeliveryType((String) req.get("delivery_type"));
        product.setCategoryId(UUID.fromString((String) req.get("category_id")));
        if (req.containsKey("low_stock_threshold")) product.setLowStockThreshold(((Number) req.get("low_stock_threshold")).intValue());
        if (req.containsKey("wholesale_enabled")) product.setWholesaleEnabled((boolean) req.get("wholesale_enabled"));
        if (req.containsKey("is_enabled")) product.setEnabled((boolean) req.get("is_enabled"));
        if (req.containsKey("initial_sales")) product.setInitialSales(((Number) req.get("initial_sales")).intValue());
        if (req.containsKey("sort_order")) product.setSortOrder(((Number) req.get("sort_order")).intValue());
        productRepository.save(product);
        return toProductDetail(product);
    }

    @Override
    @Transactional
    public void updateProduct(UUID id, Map<String, Object> req) {
        Product product = productRepository.findById(id)
                .filter(p -> p.getIsDeleted() == 0)
                .orElseThrow(() -> new BusinessException(ErrorCode.PRODUCT_NOT_FOUND, "商品不存在"));
        if (req.containsKey("title")) product.setTitle((String) req.get("title"));
        if (req.containsKey("description")) product.setDescription((String) req.get("description"));
        if (req.containsKey("detail_md")) product.setDetailMd((String) req.get("detail_md"));
        if (req.containsKey("cover_url")) product.setCoverUrl((String) req.get("cover_url"));
        if (req.containsKey("base_price")) product.setBasePrice(new BigDecimal(req.get("base_price").toString()));
        if (req.containsKey("currency")) product.setCurrency((String) req.get("currency"));
        if (req.containsKey("delivery_type")) product.setDeliveryType((String) req.get("delivery_type"));
        if (req.containsKey("category_id")) product.setCategoryId(UUID.fromString((String) req.get("category_id")));
        if (req.containsKey("low_stock_threshold")) product.setLowStockThreshold(((Number) req.get("low_stock_threshold")).intValue());
        if (req.containsKey("wholesale_enabled")) product.setWholesaleEnabled((boolean) req.get("wholesale_enabled"));
        if (req.containsKey("is_enabled")) product.setEnabled((boolean) req.get("is_enabled"));
        if (req.containsKey("initial_sales")) product.setInitialSales(((Number) req.get("initial_sales")).intValue());
        if (req.containsKey("sort_order")) product.setSortOrder(((Number) req.get("sort_order")).intValue());
        productRepository.save(product);
    }

    @Override
    @Transactional
    public void deleteProduct(UUID id) {
        Product product = productRepository.findById(id)
                .orElseThrow(() -> new BusinessException(ErrorCode.PRODUCT_NOT_FOUND, "商品不存在"));
        product.setIsDeleted(1);
        productRepository.save(product);
    }

    @Override
    public Object listSpecs(UUID productId) {
        return productSpecRepository.findByProductIdAndIsDeletedOrderBySortOrderAsc(productId, 0).stream()
                .map(this::toSpecMap).toList();
    }

    @Override
    @Transactional
    public void createSpec(UUID productId, Map<String, Object> req) {
        productRepository.findById(productId)
                .filter(p -> p.getIsDeleted() == 0)
                .orElseThrow(() -> new BusinessException(ErrorCode.PRODUCT_NOT_FOUND, "商品不存在"));
        ProductSpec spec = new ProductSpec();
        spec.setProductId(productId);
        spec.setName((String) req.get("name"));
        spec.setPrice(new BigDecimal(req.get("price").toString()));
        if (req.containsKey("is_visible")) spec.setVisible((boolean) req.get("is_visible"));
        if (req.containsKey("sort_order")) spec.setSortOrder(((Number) req.get("sort_order")).intValue());
        productSpecRepository.save(spec);
    }

    @Override
    @Transactional
    public void updateSpec(UUID productId, UUID specId, Map<String, Object> req) {
        ProductSpec spec = productSpecRepository.findById(specId)
                .filter(s -> s.getProductId().equals(productId) && s.getIsDeleted() == 0)
                .orElseThrow(() -> new BusinessException(ErrorCode.SPEC_NOT_FOUND, "规格不存在"));
        if (req.containsKey("name")) spec.setName((String) req.get("name"));
        if (req.containsKey("price")) spec.setPrice(new BigDecimal(req.get("price").toString()));
        if (req.containsKey("is_visible")) spec.setVisible((boolean) req.get("is_visible"));
        if (req.containsKey("sort_order")) spec.setSortOrder(((Number) req.get("sort_order")).intValue());
        productSpecRepository.save(spec);
    }

    @Override
    @Transactional
    public void deleteSpec(UUID productId, UUID specId) {
        ProductSpec spec = productSpecRepository.findById(specId)
                .filter(s -> s.getProductId().equals(productId))
                .orElseThrow(() -> new BusinessException(ErrorCode.SPEC_NOT_FOUND, "规格不存在"));
        spec.setIsDeleted(1);
        productSpecRepository.save(spec);
    }

    @Override
    public Object listWholesaleRules(UUID productId) {
        return wholesaleRuleRepository.findByProductIdOrderByMinQuantityAsc(productId).stream()
                .map(r -> {
                    Map<String, Object> m = new HashMap<>();
                    m.put("min_quantity", r.getMinQuantity());
                    m.put("unit_price", r.getUnitPrice());
                    return m;
                }).toList();
    }

    @Override
    @Transactional
    @SuppressWarnings("unchecked")
    public void setWholesaleRules(UUID productId, Map<String, Object> req) {
        UUID specId = req.containsKey("spec_id") && req.get("spec_id") != null
                ? UUID.fromString((String) req.get("spec_id")) : null;
        if (specId != null) {
            wholesaleRuleRepository.deleteByProductIdAndSpecId(productId, specId);
        } else {
            wholesaleRuleRepository.deleteByProductIdAndSpecIdIsNull(productId);
        }
        List<Map<String, Object>> rules = (List<Map<String, Object>>) req.get("rules");
        for (Map<String, Object> r : rules) {
            WholesaleRule rule = new WholesaleRule();
            rule.setProductId(productId);
            rule.setSpecId(specId);
            rule.setMinQuantity(((Number) r.get("min_quantity")).intValue());
            rule.setUnitPrice(new BigDecimal(r.get("unit_price").toString()));
            wholesaleRuleRepository.save(rule);
        }
    }

    private long getStockAvailable(UUID productId, UUID specId) {
        if (specId != null) {
            return cardKeyRepository.countByProductIdAndSpecIdAndStatus(productId, specId, CardKeyStatus.AVAILABLE);
        }
        return cardKeyRepository.countByProductIdAndSpecIdIsNullAndStatus(productId, CardKeyStatus.AVAILABLE);
    }

    private Map<String, Object> toProductCard(Product p) {
        Map<String, Object> map = new LinkedHashMap<>();
        map.put("id", p.getId());
        map.put("title", p.getTitle());
        map.put("description", p.getDescription());
        map.put("cover_url", p.getCoverUrl());
        map.put("base_price", p.getBasePrice());
        map.put("currency", p.getCurrency());
        map.put("category_id", p.getCategoryId());
        List<ProductSpec> specs = productSpecRepository.findByProductIdAndIsDeletedOrderBySortOrderAsc(p.getId(), 0);
        // For products with specs, sum stock across all specs; for products without specs, count spec-null keys
        long stockAvailable = specs.isEmpty()
                ? cardKeyRepository.countByProductIdAndSpecIdIsNullAndStatus(p.getId(), CardKeyStatus.AVAILABLE)
                : cardKeyRepository.countByProductIdAndStatus(p.getId(), CardKeyStatus.AVAILABLE);
        map.put("stock_available", stockAvailable);
        map.put("has_specs", !specs.isEmpty());
        map.put("delivery_type", p.getDeliveryType());
        map.put("sales_count", orderItemRepository.sumQuantityByProductId(p.getId()));
        map.put("initial_sales", p.getInitialSales());
        map.put("created_at", p.getCreatedAt());
        return map;
    }

    private Map<String, Object> toProductDetail(Product p) {
        Map<String, Object> map = new LinkedHashMap<>(toProductCard(p));
        map.put("detail_md", p.getDetailMd());
        List<ProductSpec> specs = productSpecRepository.findByProductIdAndIsDeletedOrderBySortOrderAsc(p.getId(), 0);
        map.put("specs", specs.stream().map(this::toSpecMap).toList());
        map.put("wholesale_enabled", p.isWholesaleEnabled());
        map.put("wholesale_rules", wholesaleRuleRepository.findByProductIdOrderByMinQuantityAsc(p.getId()).stream()
                .map(r -> {
                    Map<String, Object> m = new HashMap<>();
                    m.put("min_quantity", r.getMinQuantity());
                    m.put("unit_price", r.getUnitPrice());
                    return m;
                }).toList());
        return map;
    }

    private Map<String, Object> toSpecMap(ProductSpec s) {
        Map<String, Object> map = new LinkedHashMap<>();
        map.put("id", s.getId());
        map.put("name", s.getName());
        map.put("price", s.getPrice());
        map.put("stock_available", getStockAvailable(s.getProductId(), s.getId()));
        return map;
    }
}
