package com.orionkey.service;

import com.orionkey.common.PageResult;
import com.orionkey.model.request.ChangePasswordRequest;
import com.orionkey.model.response.UserProfileResponse;

import java.util.Map;
import java.util.UUID;

public interface UserService {

    UserProfileResponse getProfile(UUID userId);

    void changePassword(UUID userId, ChangePasswordRequest request);

    PageResult<?> getOrders(UUID userId, String status, int page, int pageSize);

    Map<String, Object> getPoints(UUID userId, int page, int pageSize);
}
