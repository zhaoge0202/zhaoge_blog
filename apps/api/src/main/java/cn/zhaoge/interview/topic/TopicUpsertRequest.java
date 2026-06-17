package cn.zhaoge.interview.topic;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

public record TopicUpsertRequest(
        @NotBlank String slug,
        @NotBlank String title,
        @NotBlank String summary,
        @NotBlank String content,
        String targetAudience,
        String whyImportant,
        String prerequisites,
        String knowledgeMap,
        String interviewFocus,
        @NotNull Integer sortOrder
) {
}
