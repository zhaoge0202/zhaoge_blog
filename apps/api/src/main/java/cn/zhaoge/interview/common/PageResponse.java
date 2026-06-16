package cn.zhaoge.interview.common;

import java.util.List;

public record PageResponse<T>(List<T> records, long total, long page, long size) {
}
