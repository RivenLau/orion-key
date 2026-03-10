package com.orionkey.controller;

import com.orionkey.common.ApiResponse;
import com.orionkey.constant.ErrorCode;
import com.orionkey.exception.BusinessException;
import jakarta.annotation.PostConstruct;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.io.InputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

@Slf4j
@RestController
@RequestMapping("/upload")
public class UploadController {

    private static final Set<String> ALLOWED_EXTENSIONS = Set.of(
            ".jpg", ".jpeg", ".png", ".gif", ".webp", ".bmp"
    );

    private static final Set<String> ALLOWED_CONTENT_TYPES = Set.of(
            "image/jpeg", "image/png", "image/gif", "image/webp", "image/bmp"
    );

    /**
     * 文件 Magic Bytes 前缀，用于验证文件真实类型（防止伪造 Content-Type）
     */
    private static final Map<String, byte[][]> MAGIC_BYTES = Map.of(
            ".jpg", new byte[][]{{(byte) 0xFF, (byte) 0xD8, (byte) 0xFF}},
            ".jpeg", new byte[][]{{(byte) 0xFF, (byte) 0xD8, (byte) 0xFF}},
            ".png", new byte[][]{{(byte) 0x89, 0x50, 0x4E, 0x47}},
            ".gif", new byte[][]{{0x47, 0x49, 0x46, 0x38}},  // GIF8
            ".webp", new byte[][]{{0x52, 0x49, 0x46, 0x46}}, // RIFF
            ".bmp", new byte[][]{{0x42, 0x4D}}                // BM
    );

    @Value("${upload.path:./uploads}")
    private String uploadPath;

    @Value("${upload.url-prefix:/uploads}")
    private String urlPrefix;

    private Path resolvedUploadDir;

    @PostConstruct
    public void init() throws IOException {
        Path dir = Paths.get(uploadPath);
        if (!dir.isAbsolute()) {
            dir = Paths.get(System.getProperty("user.dir")).resolve(uploadPath).normalize();
        }
        this.resolvedUploadDir = dir;
        if (!Files.exists(this.resolvedUploadDir)) {
            Files.createDirectories(this.resolvedUploadDir);
        }
        log.info("Upload directory resolved to: {}", this.resolvedUploadDir);
    }

    @PostMapping("/image")
    public ApiResponse<?> uploadImage(@RequestParam("file") MultipartFile file) {
        if (file.isEmpty()) {
            throw new BusinessException(ErrorCode.BAD_REQUEST, "文件不能为空");
        }

        // Validate content type
        String contentType = file.getContentType();
        if (contentType == null || !ALLOWED_CONTENT_TYPES.contains(contentType.toLowerCase())) {
            throw new BusinessException(ErrorCode.BAD_REQUEST, "不支持的图片格式，仅支持 JPG/PNG/GIF/WebP/BMP");
        }

        String originalFilename = file.getOriginalFilename();
        String extension = "";
        if (originalFilename != null && originalFilename.contains(".")) {
            extension = originalFilename.substring(originalFilename.lastIndexOf(".")).toLowerCase();
        }

        // Validate file extension
        if (extension.isEmpty() || !ALLOWED_EXTENSIONS.contains(extension)) {
            throw new BusinessException(ErrorCode.BAD_REQUEST, "不支持的文件扩展名，仅支持 jpg/png/gif/webp/bmp");
        }

        // Validate Magic Bytes (防止伪造 Content-Type 上传恶意文件)
        if (!verifyMagicBytes(file, extension)) {
            throw new BusinessException(ErrorCode.BAD_REQUEST, "文件内容与扩展名不匹配，疑似伪造文件");
        }

        String filename = UUID.randomUUID() + extension;

        try {
            Path target = resolvedUploadDir.resolve(filename);
            file.transferTo(target.toFile());
            log.info("File uploaded: {}", target);

            String url = urlPrefix + "/" + filename;
            return ApiResponse.success(Map.of("url", url));
        } catch (IOException e) {
            log.error("File upload failed", e);
            throw new BusinessException(ErrorCode.SERVER_ERROR, "文件上传失败");
        }
    }

    /**
     * 校验文件头部 Magic Bytes 是否与声明的扩展名匹配
     */
    private boolean verifyMagicBytes(MultipartFile file, String extension) {
        byte[][] expected = MAGIC_BYTES.get(extension);
        if (expected == null) return true; // 无规则的扩展名跳过

        try (InputStream is = file.getInputStream()) {
            byte[] header = new byte[8];
            int read = is.read(header);
            if (read < 2) return false;

            for (byte[] magic : expected) {
                if (read >= magic.length && startsWith(header, magic)) {
                    return true;
                }
            }
            return false;
        } catch (IOException e) {
            log.warn("Failed to read file header for magic bytes check", e);
            return false;
        }
    }

    private static boolean startsWith(byte[] data, byte[] prefix) {
        for (int i = 0; i < prefix.length; i++) {
            if (data[i] != prefix[i]) return false;
        }
        return true;
    }
}
