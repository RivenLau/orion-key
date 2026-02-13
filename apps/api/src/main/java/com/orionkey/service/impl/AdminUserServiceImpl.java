package com.orionkey.service.impl;

import com.orionkey.common.PageResult;
import com.orionkey.constant.ErrorCode;
import com.orionkey.entity.User;
import com.orionkey.exception.BusinessException;
import com.orionkey.repository.UserRepository;
import com.orionkey.service.AdminUserService;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.*;

@Service
@RequiredArgsConstructor
public class AdminUserServiceImpl implements AdminUserService {

    private final UserRepository userRepository;

    @Override
    public PageResult<?> listUsers(String keyword, int page, int pageSize) {
        var pageable = PageRequest.of(page - 1, pageSize);
        Page<User> userPage;
        if (keyword != null && !keyword.isBlank()) {
            userPage = userRepository.findByUsernameContainingOrEmailContaining(keyword, keyword, pageable);
        } else {
            userPage = userRepository.findAll(pageable);
        }
        var list = userPage.getContent().stream().map(u -> {
            Map<String, Object> map = new LinkedHashMap<>();
            map.put("id", u.getId());
            map.put("username", u.getUsername());
            map.put("email", u.getEmail());
            map.put("role", u.getRole().name());
            map.put("points", u.getPoints());
            map.put("is_deleted", u.getIsDeleted());
            map.put("created_at", u.getCreatedAt());
            return map;
        }).toList();
        return PageResult.of(userPage, list);
    }

    @Override
    @Transactional
    public void toggleUser(UUID id, int isDeleted) {
        User user = userRepository.findById(id)
                .orElseThrow(() -> new BusinessException(ErrorCode.NOT_FOUND, "用户不存在"));
        user.setIsDeleted(isDeleted);
        userRepository.save(user);
    }
}
