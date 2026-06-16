package cn.zhaoge.interview.question;

import cn.zhaoge.interview.common.ApiResponse;
import cn.zhaoge.interview.common.PageResponse;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/public/questions")
public class PublicQuestionController {
    private final QuestionService questionService;

    public PublicQuestionController(QuestionService questionService) {
        this.questionService = questionService;
    }

    @GetMapping
    public ApiResponse<PageResponse<QuestionSummaryDto>> list(
            @RequestParam(required = false) Long topicId,
            @RequestParam(required = false) String keyword,
            @RequestParam(defaultValue = "1") long page,
            @RequestParam(defaultValue = "10") long size
    ) {
        return ApiResponse.ok(questionService.listPublished(topicId, keyword, page, size));
    }

    @GetMapping("/{slug}")
    public ApiResponse<QuestionDetailDto> detail(@PathVariable String slug) {
        return ApiResponse.ok(questionService.getPublishedBySlug(slug));
    }
}
