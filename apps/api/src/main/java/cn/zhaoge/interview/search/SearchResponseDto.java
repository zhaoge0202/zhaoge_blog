package cn.zhaoge.interview.search;

import java.util.List;

public record SearchResponseDto(
        String keyword,
        List<SearchResultDto> topics,
        List<SearchResultDto> questions,
        List<SearchResultDto> notes,
        int total
) {
}
