package cn.zhaoge.interview.question;

import java.util.List;

public record QuestionDetailDto(
        Long id,
        Long topicId,
        String slug,
        String title,
        String summary,
        String difficulty,
        String frequency,
        String masteryLevel,
        String content,
        String shortAnswer,
        String longAnswer,
        String deepDive,
        String answerStrategy,
        Integer sortOrder,
        String status,
        List<QuestionSection> sections,
        List<FollowUpQuestion> followUps,
        List<Misconception> misconceptions,
        List<CorrectionNote> corrections,
        List<ProjectMapping> projectMappings,
        List<ReferenceSource> references
) {
    public static QuestionDetailDto from(
            Question question,
            List<QuestionSection> sections,
            List<FollowUpQuestion> followUps,
            List<Misconception> misconceptions,
            List<CorrectionNote> corrections,
            List<ProjectMapping> projectMappings,
            List<ReferenceSource> references
    ) {
        return new QuestionDetailDto(
                question.getId(),
                question.getTopicId(),
                question.getSlug(),
                question.getTitle(),
                question.getSummary(),
                question.getDifficulty(),
                question.getFrequency(),
                question.getMasteryLevel(),
                question.getContent(),
                question.getShortAnswer(),
                question.getLongAnswer(),
                question.getDeepDive(),
                question.getAnswerStrategy(),
                question.getSortOrder(),
                question.getStatus(),
                sections,
                followUps,
                misconceptions,
                corrections,
                projectMappings,
                references
        );
    }
}
