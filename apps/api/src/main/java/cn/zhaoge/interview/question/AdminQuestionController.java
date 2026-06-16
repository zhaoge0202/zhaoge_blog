package cn.zhaoge.interview.question;

import cn.zhaoge.interview.common.ApiResponse;
import cn.zhaoge.interview.common.ContentStatus;
import cn.zhaoge.interview.common.PageResponse;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/admin/questions")
public class AdminQuestionController {
    private final QuestionService questionService;

    public AdminQuestionController(QuestionService questionService) {
        this.questionService = questionService;
    }

    @GetMapping
    public ApiResponse<PageResponse<QuestionSummaryDto>> list(
            @RequestParam(name = "topicId", required = false) Long topicId,
            @RequestParam(name = "status", required = false) String status,
            @RequestParam(name = "keyword", required = false) String keyword,
            @RequestParam(name = "page", defaultValue = "1") long page,
            @RequestParam(name = "size", defaultValue = "10") long size
    ) {
        return ApiResponse.ok(questionService.listAdmin(topicId, status, keyword, page, size));
    }

    @GetMapping("/{id}")
    public ApiResponse<QuestionDetailDto> detail(@PathVariable Long id) {
        return ApiResponse.ok(questionService.getAdminById(id));
    }

    @PostMapping
    public ApiResponse<QuestionDetailDto> create(@Valid @RequestBody QuestionUpsertRequest request) {
        return ApiResponse.ok(questionService.create(request));
    }

    @PutMapping("/{id}")
    public ApiResponse<QuestionDetailDto> update(@PathVariable Long id, @Valid @RequestBody QuestionUpsertRequest request) {
        return ApiResponse.ok(questionService.update(id, request));
    }

    @PatchMapping("/{id}/status")
    public ApiResponse<QuestionDetailDto> updateStatus(@PathVariable Long id, @RequestParam(name = "status") ContentStatus status) {
        return ApiResponse.ok(questionService.updateStatus(id, status));
    }
}
