package cn.zhaoge.interview.note;

import cn.zhaoge.interview.common.NoteType;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import java.time.LocalDate;

public record PersonalNoteUpsertRequest(
        Long topicId,
        Long questionId,
        @NotNull NoteType noteType,
        @NotBlank String title,
        @NotBlank String content,
        @NotNull LocalDate happenedOn,
        @NotNull Integer sortOrder
) {
}
