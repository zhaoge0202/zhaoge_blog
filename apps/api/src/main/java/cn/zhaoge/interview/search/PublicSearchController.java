package cn.zhaoge.interview.search;

import cn.zhaoge.interview.common.ApiResponse;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/public/search")
public class PublicSearchController {
    private final SearchService searchService;

    public PublicSearchController(SearchService searchService) {
        this.searchService = searchService;
    }

    @GetMapping
    public ApiResponse<SearchResponseDto> search(
            @RequestParam(name = "keyword", required = false) String keyword,
            @RequestParam(name = "limit", defaultValue = "5") int limit
    ) {
        return ApiResponse.ok(searchService.search(keyword, limit));
    }
}
