package cn.zhaoge.interview.note;

import cn.zhaoge.interview.common.ApiResponse;
import java.util.List;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/public/notes")
public class PublicNoteController {
    private final PersonalNoteService personalNoteService;

    public PublicNoteController(PersonalNoteService personalNoteService) {
        this.personalNoteService = personalNoteService;
    }

    @GetMapping
    public ApiResponse<List<PersonalNoteDto>> list() {
        return ApiResponse.ok(personalNoteService.listPublished());
    }
}
