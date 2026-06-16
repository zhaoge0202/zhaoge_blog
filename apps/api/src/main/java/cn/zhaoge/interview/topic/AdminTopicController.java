package cn.zhaoge.interview.topic;

import cn.zhaoge.interview.common.ApiResponse;
import cn.zhaoge.interview.common.ContentStatus;
import jakarta.validation.Valid;
import java.util.List;
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
@RequestMapping("/api/admin/topics")
public class AdminTopicController {
    private final TopicService topicService;

    public AdminTopicController(TopicService topicService) {
        this.topicService = topicService;
    }

    @GetMapping
    public ApiResponse<List<TopicDto>> list() {
        return ApiResponse.ok(topicService.listAdmin());
    }

    @PostMapping
    public ApiResponse<TopicDto> create(@Valid @RequestBody TopicUpsertRequest request) {
        return ApiResponse.ok(topicService.create(request));
    }

    @PutMapping("/{id}")
    public ApiResponse<TopicDto> update(@PathVariable Long id, @Valid @RequestBody TopicUpsertRequest request) {
        return ApiResponse.ok(topicService.update(id, request));
    }

    @PatchMapping("/{id}/status")
    public ApiResponse<TopicDto> updateStatus(@PathVariable Long id, @RequestParam(name = "status") ContentStatus status) {
        return ApiResponse.ok(topicService.updateStatus(id, status));
    }
}
