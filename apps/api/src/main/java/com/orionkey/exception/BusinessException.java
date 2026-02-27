package com.orionkey.exception;

import lombok.Getter;
import org.springframework.http.HttpStatus;

import java.util.Map;

@Getter
public class BusinessException extends RuntimeException {

    private final int code;
    private final HttpStatus httpStatus;
    private final Map<String, Object> params;

    public BusinessException(int code, String message) {
        this(code, message, HttpStatus.BAD_REQUEST, null);
    }

    public BusinessException(int code, String message, HttpStatus httpStatus) {
        this(code, message, httpStatus, null);
    }

    public BusinessException(int code, String message, Map<String, Object> params) {
        this(code, message, HttpStatus.BAD_REQUEST, params);
    }

    public BusinessException(int code, String message, HttpStatus httpStatus, Map<String, Object> params) {
        super(message);
        this.code = code;
        this.httpStatus = httpStatus;
        this.params = params;
    }
}
