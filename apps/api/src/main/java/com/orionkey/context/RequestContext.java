package com.orionkey.context;

import java.util.UUID;

public class RequestContext {

    private static final ThreadLocal<UserInfo> CURRENT_USER = new ThreadLocal<>();

    public static void set(UserInfo userInfo) {
        CURRENT_USER.set(userInfo);
    }

    public static UserInfo get() {
        return CURRENT_USER.get();
    }

    public static UUID getUserId() {
        UserInfo info = get();
        return info != null ? info.getUserId() : null;
    }

    public static String getRole() {
        UserInfo info = get();
        return info != null ? info.getRole() : null;
    }

    public static void clear() {
        CURRENT_USER.remove();
    }

    public static class UserInfo {
        private final UUID userId;
        private final String username;
        private final String role;

        public UserInfo(UUID userId, String username, String role) {
            this.userId = userId;
            this.username = username;
            this.role = role;
        }

        public UUID getUserId() { return userId; }
        public String getUsername() { return username; }
        public String getRole() { return role; }
    }
}
