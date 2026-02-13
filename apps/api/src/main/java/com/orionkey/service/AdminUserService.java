package com.orionkey.service;

import com.orionkey.common.PageResult;

import java.util.UUID;

public interface AdminUserService {

    PageResult<?> listUsers(String keyword, int page, int pageSize);

    void toggleUser(UUID id, int isDeleted);
}
