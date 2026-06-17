package cn.zhaoge.interview.question;

import cn.zhaoge.interview.common.Difficulty;
import cn.zhaoge.interview.common.Frequency;
import cn.zhaoge.interview.common.MasteryLevel;
import cn.zhaoge.interview.common.SectionType;
import cn.zhaoge.interview.common.SourceType;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import java.util.List;

public record QuestionUpsertRequest(
        @NotNull Long topicId,
        @NotBlank String slug,
        @NotBlank String title,
        @NotBlank String summary,
        @NotNull Difficulty difficulty,
        @NotNull Frequency frequency,
        @NotNull MasteryLevel masteryLevel,
        @NotBlank String content,
        String shortAnswer,
        String longAnswer,
        String deepDive,
        String answerStrategy,
        @NotNull Integer sortOrder,
        @Valid List<SectionRequest> sections,
        @Valid List<FollowUpRequest> followUps,
        @Valid List<MisconceptionRequest> misconceptions,
        @Valid List<CorrectionRequest> corrections,
        @Valid List<ProjectMappingRequest> projectMappings,
        @Valid List<ReferenceRequest> references
) {
    public record SectionRequest(@NotNull SectionType sectionType, @NotBlank String title, @NotBlank String content, @NotNull Integer sortOrder) {}
    public record FollowUpRequest(@NotBlank String questionText, @NotBlank String answerHint, @NotNull Integer sortOrder) {}
    public record MisconceptionRequest(@NotBlank String wrongStatement, @NotBlank String whyWrong, @NotBlank String correctStatement, @NotNull Integer sortOrder) {}
    public record CorrectionRequest(@NotBlank String title, @NotBlank String problem, @NotBlank String correction, @NotBlank String evidence, @NotNull SourceType sourceType) {}
    public record ProjectMappingRequest(@NotBlank String scenario, @NotBlank String projectTalkingPoint, @NotBlank String riskPoint, @NotBlank String interviewAnswer, @NotNull Integer sortOrder) {}
    public record ReferenceRequest(@NotBlank String sourceName, @NotBlank String sourceUrl, @NotNull SourceType sourceType, @NotBlank String usageNote, @NotNull Integer sortOrder) {}
}
