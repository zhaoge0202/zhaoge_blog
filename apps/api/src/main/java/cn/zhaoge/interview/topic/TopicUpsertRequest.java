package cn.zhaoge.interview.topic;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

public record TopicUpsertRequest(
        @NotBlank String slug,
        @NotBlank String title,
        @NotBlank String summary,
        @NotBlank String targetAudience,
        @NotBlank String whyImportant,
        @NotBlank String prerequisites,
        @NotBlank String knowledgeMap,
        @NotBlank String interviewFocus,
        @NotNull Integer sortOrder
) {
}
