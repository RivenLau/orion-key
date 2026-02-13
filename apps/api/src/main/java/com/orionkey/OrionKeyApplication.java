package com.orionkey;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.scheduling.annotation.EnableScheduling;

@SpringBootApplication
@EnableScheduling
public class OrionKeyApplication {

    public static void main(String[] args) {
        SpringApplication.run(OrionKeyApplication.class, args);
    }
}
