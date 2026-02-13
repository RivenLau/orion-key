package com.orionkey.service;

import com.orionkey.model.request.LoginRequest;
import com.orionkey.model.request.RegisterRequest;
import com.orionkey.model.response.AuthResponse;
import com.orionkey.model.response.CaptchaResponse;

public interface AuthService {

    CaptchaResponse generateCaptcha();

    AuthResponse register(RegisterRequest request);

    AuthResponse login(LoginRequest request, String sessionToken);

    void logout();
}
