package cn.zhaoge.interview.tag;

import cn.zhaoge.interview.common.ApiResponse;
import jakarta.validation.Valid;
import java.util.List;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/admin/tags")
public class AdminTagController {
    private final TagService tagService;

    public AdminTagController(TagService tagService) {
        this.tagService = tagService;
    }

    @GetMapping
    public ApiResponse<List<TagDto>> list() {
        return ApiResponse.ok(tagService.list());
    }

    @PostMapping
    public ApiResponse<TagDto> create(@Valid @RequestBody TagUpsertRequest request) {
        return ApiResponse.ok(tagService.create(request));
    }

    @PutMapping("/{id}")
    public ApiResponse<TagDto> update(@PathVariable(name = "id") Long id, @Valid @RequestBody TagUpsertRequest request) {
        return ApiResponse.ok(tagService.update(id, request));
    }
}
