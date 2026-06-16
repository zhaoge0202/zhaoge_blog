package cn.zhaoge.interview.search;

public record SearchResultDto(
        String type,
        Long id,
        String slug,
        String title,
        String summary,
        String url,
        Integer sortOrder
) {
}
