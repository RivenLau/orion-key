package com.orionkey.common;

import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.springframework.data.domain.Page;

import java.util.List;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class PageResult<T> {

    private List<T> list;
    private Pagination pagination;

    @Getter
    @Setter
    @NoArgsConstructor
    @AllArgsConstructor
    public static class Pagination {
        private int page;
        private int pageSize;
        private long total;
    }

    public static <T> PageResult<T> of(Page<?> page, List<T> list) {
        return new PageResult<>(list,
                new Pagination(page.getNumber() + 1, page.getSize(), page.getTotalElements()));
    }

    public static <T> PageResult<T> of(List<T> list, int page, int pageSize, long total) {
        return new PageResult<>(list, new Pagination(page, pageSize, total));
    }
}
