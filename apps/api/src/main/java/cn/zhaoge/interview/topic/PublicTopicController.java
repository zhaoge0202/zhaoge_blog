package cn.zhaoge.interview.topic;

import cn.zhaoge.interview.common.ApiResponse;
import java.util.List;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/public/topics")
public class PublicTopicController {
    private final TopicService topicService;

    public PublicTopicController(TopicService topicService) {
        this.topicService = topicService;
    }

    @GetMapping
    public ApiResponse<List<TopicDto>> list() {
        return ApiResponse.ok(topicService.listPublished());
    }

    @GetMapping("/{slug}")
    public ApiResponse<TopicDto> detail(@PathVariable String slug) {
        return ApiResponse.ok(topicService.getPublishedBySlug(slug));
    }
}
