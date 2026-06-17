package cn.zhaoge.interview.topic;

import java.time.LocalDateTime;

public record TopicDto(
        Long id,
        String slug,
        String title,
        String summary,
        String content,
        String targetAudience,
        String whyImportant,
        String prerequisites,
        String knowledgeMap,
        String interviewFocus,
        Integer sortOrder,
        String status,
        LocalDateTime updatedAt
) {
    public static TopicDto from(Topic topic) {
        return new TopicDto(
                topic.getId(),
                topic.getSlug(),
                topic.getTitle(),
                topic.getSummary(),
                topic.getContent(),
                topic.getTargetAudience(),
                topic.getWhyImportant(),
                topic.getPrerequisites(),
                topic.getKnowledgeMap(),
                topic.getInterviewFocus(),
                topic.getSortOrder(),
                topic.getStatus(),
                topic.getUpdatedAt()
        );
    }
}
