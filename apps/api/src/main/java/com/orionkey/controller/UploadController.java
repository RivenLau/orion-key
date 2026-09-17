package com.orionkey.controller;

import com.orionkey.common.ApiResponse;
import com.orionkey.context.RequestContext;
import com.orionkey.constant.UserRole;
import com.orionkey.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import java.io.ByteArrayInputStream;
import javax.imageio.ImageIO;
import javax.imageio.ImageReader;
import javax.imageio.stream.MemoryCacheImageInputStream;
import java.nio.charset.StandardCharsets;
import java.util.Locale;
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
@RequiredArgsConstructor
@RestController
@RequestMapping("/upload")
public class UploadController {

    private final UserRepository userRepository;
    private static final int MAX_BYTES = 10 * 1024 * 1024;
    private static final int MAX_SIDE = 8192;
    private static final long MAX_PIXELS = 40_000_000;
    private static final long MAX_ANIMATION_PIXELS = 100_000_000;

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

    @PostMapping("/ad-image")
    public ApiResponse<?> uploadAdImage(@RequestParam("file") MultipartFile file) {
        // Revalidate the administrator only for advertisement uploads.
        UUID userId = RequestContext.getUserId();
        var user = userId == null ? null : userRepository.findById(userId).orElse(null);
        if (!"ADMIN".equals(RequestContext.getRole()) || user == null
                || user.getIsDeleted() == 1 || user.getRole() != UserRole.ADMIN) {
            throw new BusinessException(ErrorCode.UNAUTHORIZED, "Administrator session is no longer valid", org.springframework.http.HttpStatus.UNAUTHORIZED);
        }
        if (file.isEmpty() || file.getSize() > MAX_BYTES) {
            throw new BusinessException(ErrorCode.BAD_REQUEST, "图片不能为空，且不能超过 10MB");
        }

        // Validate content type
        String contentType = file.getContentType();
        if (contentType == null || !ALLOWED_CONTENT_TYPES.contains(contentType.toLowerCase(Locale.ROOT))) {
            throw new BusinessException(ErrorCode.BAD_REQUEST, "不支持的图片格式，仅支持 JPG/PNG/GIF/WebP");
        }

        String originalFilename = file.getOriginalFilename();
        String extension = "";
        if (originalFilename != null && originalFilename.contains(".")) {
            extension = originalFilename.substring(originalFilename.lastIndexOf(".")).toLowerCase(Locale.ROOT);
        }

        // Validate file extension
        if (extension.isEmpty() || !ALLOWED_EXTENSIONS.contains(extension) || extension.equals(".bmp")) {
            throw new BusinessException(ErrorCode.BAD_REQUEST, "不支持的文件扩展名，仅支持 jpg/png/gif/webp");
        }

        String expectedType = switch (extension) {
            case ".jpg", ".jpeg" -> "image/jpeg";
            default -> "image/" + extension.substring(1);
        };
        if (!expectedType.equalsIgnoreCase(contentType)) throw invalidImage();

        byte[] contents;
        int[] dimensions;
        try (var input = file.getInputStream()) {
            contents = input.readNBytes(MAX_BYTES + 1);
            if (contents.length == 0 || contents.length > MAX_BYTES) throw invalidImage();
            dimensions = inspectImage(contents, extension);
        } catch (IOException | IllegalArgumentException e) {
            throw invalidImage();
        }

        String filename = UUID.randomUUID() + extension;

        try {
            Path adUploadDir = resolvedUploadDir.toAbsolutePath().normalize();
            Path target = adUploadDir.resolve(filename).normalize();
            if (!target.startsWith(adUploadDir)) throw invalidImage();
            Files.write(target, contents, java.nio.file.StandardOpenOption.CREATE_NEW);
            log.info("File uploaded: {}", target);

            String url = urlPrefix + "/" + filename;
            return ApiResponse.success(Map.of("url", url, "width", dimensions[0], "height", dimensions[1]));
        } catch (IOException e) {
            log.error("File upload failed", e);
            throw new BusinessException(ErrorCode.SERVER_ERROR, "文件上传失败");
        }
    }

    private static BusinessException invalidImage() {
        return new BusinessException(ErrorCode.BAD_REQUEST, "图片格式无效或超出安全尺寸限制");
    }

    private static void checkDimensions(int width, int height) {
        if (width < 1 || height < 1 || width > MAX_SIDE || height > MAX_SIDE
                || (long) width * height > MAX_PIXELS) throw invalidImage();
    }

    private static int[] inspectImage(byte[] bytes, String extension) throws IOException {
        if (".webp".equals(extension)) return inspectWebp(bytes);
        try (var input = new MemoryCacheImageInputStream(new ByteArrayInputStream(bytes))) {
            var readers = ImageIO.getImageReaders(input);
            if (!readers.hasNext()) throw invalidImage();
            ImageReader reader = readers.next();
            try {
                String format = reader.getFormatName().toLowerCase(Locale.ROOT);
                String expected = extension.equals(".jpg") ? "jpeg" : extension.substring(1);
                if (!format.equals(expected)) throw invalidImage();
                reader.setInput(input, false, false);
                int width = reader.getWidth(0);
                int height = reader.getHeight(0);
                if (format.equals("gif")) {
                    width = (int) littleEndian(bytes, 6, 2);
                    height = (int) littleEndian(bytes, 8, 2);
                }
                checkDimensions(width, height);
                int frames = format.equals("gif") ? reader.getNumImages(true) : 1;
                if (frames < 1 || frames > 500 || (long) width * height * frames > MAX_ANIMATION_PIXELS) throw invalidImage();
                long pixels = 0;
                for (int i = 0; i < frames; i++) {
                    int w = reader.getWidth(i), h = reader.getHeight(i);
                    checkDimensions(w, h);
                    pixels += (long) w * h;
                    if (pixels > MAX_ANIMATION_PIXELS) throw invalidImage();
                }
                // Validate the first frame only after bounding its decoded allocation.
                var image = reader.read(0);
                if (image == null) throw invalidImage();
                image.flush();
                return new int[]{width, height};
            } finally {
                reader.dispose();
            }
        }
    }

    private static String fourCC(byte[] bytes, int offset) {
        if (offset < 0 || offset + 4 > bytes.length) throw invalidImage();
        return new String(bytes, offset, 4, StandardCharsets.US_ASCII);
    }

    private static long littleEndian(byte[] bytes, int offset, int count) {
        if (offset < 0 || offset + count > bytes.length) throw invalidImage();
        long result = 0;
        for (int i = 0; i < count; i++) result |= (long) (bytes[offset + i] & 255) << (8 * i);
        return result;
    }

    // WebP has no built-in ImageIO reader. Inspect bounded RIFF chunks without decoding.
    private static int[] inspectWebp(byte[] bytes) {
        if (bytes.length < 20 || !"RIFF".equals(fourCC(bytes, 0)) || !"WEBP".equals(fourCC(bytes, 8))
                || littleEndian(bytes, 4, 4) + 8 != bytes.length) throw invalidImage();
        int width = 0, height = 0, frames = 0;
        boolean pixelsFound = false;
        for (int offset = 12; offset < bytes.length;) {
            if (offset + 8 > bytes.length) throw invalidImage();
            String chunk = fourCC(bytes, offset);
            long size = littleEndian(bytes, offset + 4, 4);
            long next = offset + 8L + size + (size & 1);
            if (next > bytes.length) throw invalidImage();
            int data = offset + 8;
            if ("VP8X".equals(chunk)) {
                if (size != 10 || width != 0) throw invalidImage();
                width = (int) littleEndian(bytes, data + 4, 3) + 1;
                height = (int) littleEndian(bytes, data + 7, 3) + 1;
                checkDimensions(width, height);
            } else if ("VP8 ".equals(chunk) || "VP8L".equals(chunk)) {
                int[] frame = webpFrame(bytes, data, size, chunk);
                if (width == 0) { width = frame[0]; height = frame[1]; }
                if (frame[0] != width || frame[1] != height) throw invalidImage();
                pixelsFound = true;
            } else if ("ANMF".equals(chunk)) {
                if (width == 0 || size < 24 || ++frames > 500) throw invalidImage();
                int x = (int) littleEndian(bytes, data, 3) * 2;
                int y = (int) littleEndian(bytes, data + 3, 3) * 2;
                int w = (int) littleEndian(bytes, data + 6, 3) + 1;
                int h = (int) littleEndian(bytes, data + 9, 3) + 1;
                checkDimensions(w, h);
                if ((long) x + w > width || (long) y + h > height
                        || (long) width * height * frames > MAX_ANIMATION_PIXELS) throw invalidImage();
                boolean frameFound = false;
                for (int nested = data + 16; nested < data + size;) {
                    if (nested + 8 > data + size) throw invalidImage();
                    String kind = fourCC(bytes, nested);
                    long length = littleEndian(bytes, nested + 4, 4);
                    long end = nested + 8L + length + (length & 1);
                    if (end > data + size) throw invalidImage();
                    if ("VP8 ".equals(kind) || "VP8L".equals(kind)) {
                        int[] frame = webpFrame(bytes, nested + 8, length, kind);
                        if (frame[0] != w || frame[1] != h) throw invalidImage();
                        frameFound = true;
                    }
                    nested = (int) end;
                }
                if (!frameFound) throw invalidImage();
                pixelsFound = true;
            }
            offset = (int) next;
        }
        if (!pixelsFound) throw invalidImage();
        checkDimensions(width, height);
        return new int[]{width, height};
    }

    private static int[] webpFrame(byte[] bytes, int data, long size, String kind) {
        int width, height;
        if ("VP8L".equals(kind)) {
            if (size < 5 || (bytes[data] & 255) != 0x2f) throw invalidImage();
            long bits = littleEndian(bytes, data + 1, 4);
            if ((bits >>> 29) != 0) throw invalidImage();
            width = (int) (bits & 0x3fff) + 1;
            height = (int) ((bits >>> 14) & 0x3fff) + 1;
        } else {
            if (size < 10 || (bytes[data] & 1) != 0 || (bytes[data + 3] & 255) != 0x9d
                    || bytes[data + 4] != 1 || bytes[data + 5] != 0x2a) throw invalidImage();
            width = (int) littleEndian(bytes, data + 6, 2) & 0x3fff;
            height = (int) littleEndian(bytes, data + 8, 2) & 0x3fff;
        }
        checkDimensions(width, height);
        return new int[]{width, height};
    }
}
