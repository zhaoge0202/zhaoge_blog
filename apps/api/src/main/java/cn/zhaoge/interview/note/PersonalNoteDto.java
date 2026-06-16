package cn.zhaoge.interview.note;

import java.time.LocalDate;

public record PersonalNoteDto(
        Long id,
        Long topicId,
        Long questionId,
        String noteType,
        String title,
        String content,
        LocalDate happenedOn,
        Integer sortOrder,
        String status
) {
    public static PersonalNoteDto from(PersonalNote note) {
        return new PersonalNoteDto(
                note.getId(),
                note.getTopicId(),
                note.getQuestionId(),
                note.getNoteType(),
                note.getTitle(),
                note.getContent(),
                note.getHappenedOn(),
                note.getSortOrder(),
                note.getStatus()
        );
    }
}
