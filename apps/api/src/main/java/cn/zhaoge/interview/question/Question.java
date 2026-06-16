package cn.zhaoge.interview.question;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import java.time.LocalDateTime;

@TableName("questions")
public class Question {
    @TableId(type = IdType.AUTO)
    private Long id;
    private Long topicId;
    private String slug;
    private String title;
    private String summary;
    private String difficulty;
    private String frequency;
    private String masteryLevel;
    private String shortAnswer;
    private String longAnswer;
    private String deepDive;
    private String answerStrategy;
    private Integer sortOrder;
    private String status;
    private LocalDateTime publishedAt;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public Long getTopicId() { return topicId; }
    public void setTopicId(Long topicId) { this.topicId = topicId; }
    public String getSlug() { return slug; }
    public void setSlug(String slug) { this.slug = slug; }
    public String getTitle() { return title; }
    public void setTitle(String title) { this.title = title; }
    public String getSummary() { return summary; }
    public void setSummary(String summary) { this.summary = summary; }
    public String getDifficulty() { return difficulty; }
    public void setDifficulty(String difficulty) { this.difficulty = difficulty; }
    public String getFrequency() { return frequency; }
    public void setFrequency(String frequency) { this.frequency = frequency; }
    public String getMasteryLevel() { return masteryLevel; }
    public void setMasteryLevel(String masteryLevel) { this.masteryLevel = masteryLevel; }
    public String getShortAnswer() { return shortAnswer; }
    public void setShortAnswer(String shortAnswer) { this.shortAnswer = shortAnswer; }
    public String getLongAnswer() { return longAnswer; }
    public void setLongAnswer(String longAnswer) { this.longAnswer = longAnswer; }
    public String getDeepDive() { return deepDive; }
    public void setDeepDive(String deepDive) { this.deepDive = deepDive; }
    public String getAnswerStrategy() { return answerStrategy; }
    public void setAnswerStrategy(String answerStrategy) { this.answerStrategy = answerStrategy; }
    public Integer getSortOrder() { return sortOrder; }
    public void setSortOrder(Integer sortOrder) { this.sortOrder = sortOrder; }
    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }
    public LocalDateTime getPublishedAt() { return publishedAt; }
    public void setPublishedAt(LocalDateTime publishedAt) { this.publishedAt = publishedAt; }
    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }
    public LocalDateTime getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(LocalDateTime updatedAt) { this.updatedAt = updatedAt; }
}
