package cn.zhaoge.interview.question;

public record QuestionSummaryDto(
        Long id,
        Long topicId,
        String slug,
        String title,
        String summary,
        String difficulty,
        String frequency,
        String masteryLevel,
        Integer sortOrder,
        String status
) {
    public static QuestionSummaryDto from(Question question) {
        return new QuestionSummaryDto(
                question.getId(),
                question.getTopicId(),
                question.getSlug(),
                question.getTitle(),
                question.getSummary(),
                question.getDifficulty(),
                question.getFrequency(),
                question.getMasteryLevel(),
                question.getSortOrder(),
                question.getStatus()
        );
    }
}
