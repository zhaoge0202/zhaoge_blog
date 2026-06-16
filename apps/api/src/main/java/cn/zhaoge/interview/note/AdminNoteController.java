package cn.zhaoge.interview.note;

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
@RequestMapping("/api/admin/notes")
public class AdminNoteController {
    private final PersonalNoteService personalNoteService;

    public AdminNoteController(PersonalNoteService personalNoteService) {
        this.personalNoteService = personalNoteService;
    }

    @GetMapping
    public ApiResponse<List<PersonalNoteDto>> list() {
        return ApiResponse.ok(personalNoteService.listAdmin());
    }

    @PostMapping
    public ApiResponse<PersonalNoteDto> create(@Valid @RequestBody PersonalNoteUpsertRequest request) {
        return ApiResponse.ok(personalNoteService.create(request));
    }

    @PutMapping("/{id}")
    public ApiResponse<PersonalNoteDto> update(@PathVariable Long id, @Valid @RequestBody PersonalNoteUpsertRequest request) {
        return ApiResponse.ok(personalNoteService.update(id, request));
    }

    @PatchMapping("/{id}/status")
    public ApiResponse<PersonalNoteDto> updateStatus(@PathVariable Long id, @RequestParam ContentStatus status) {
        return ApiResponse.ok(personalNoteService.updateStatus(id, status));
    }
}
