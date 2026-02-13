package com.orionkey.model.response;

import com.orionkey.entity.User;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.LocalDateTime;
import java.util.UUID;

@Getter
@Setter
@NoArgsConstructor
public class UserProfileResponse {
    private UUID id;
    private String username;
    private String email;
    private String role;
    private int points;
    private LocalDateTime createdAt;

    public static UserProfileResponse from(User user) {
        UserProfileResponse r = new UserProfileResponse();
        r.setId(user.getId());
        r.setUsername(user.getUsername());
        r.setEmail(user.getEmail());
        r.setRole(user.getRole().name());
        r.setPoints(user.getPoints());
        r.setCreatedAt(user.getCreatedAt());
        return r;
    }
}
