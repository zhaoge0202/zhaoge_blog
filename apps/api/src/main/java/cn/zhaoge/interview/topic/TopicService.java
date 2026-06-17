package cn.zhaoge.interview.topic;

import cn.zhaoge.interview.common.ContentStatus;
import cn.zhaoge.interview.topic.mapper.TopicMapper;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import java.util.List;
import org.springframework.stereotype.Service;

@Service
public class TopicService {
    private final TopicMapper topicMapper;

    public TopicService(TopicMapper topicMapper) {
        this.topicMapper = topicMapper;
    }

    public List<TopicDto> listPublished() {
        return topicMapper.selectList(new LambdaQueryWrapper<Topic>()
                        .eq(Topic::getStatus, ContentStatus.PUBLISHED.name())
                        .orderByAsc(Topic::getSortOrder))
                .stream()
                .map(TopicDto::from)
                .toList();
    }

    public List<TopicDto> listAdmin() {
        return topicMapper.selectList(new LambdaQueryWrapper<Topic>()
                        .orderByAsc(Topic::getSortOrder))
                .stream()
                .map(TopicDto::from)
                .toList();
    }

    public TopicDto getPublishedBySlug(String slug) {
        Topic topic = topicMapper.selectOne(new LambdaQueryWrapper<Topic>()
                .eq(Topic::getSlug, slug)
                .eq(Topic::getStatus, ContentStatus.PUBLISHED.name()));
        if (topic == null) {
            throw new IllegalArgumentException("Topic not found");
        }
        return TopicDto.from(topic);
    }

    public TopicDto create(TopicUpsertRequest request) {
        Topic topic = new Topic();
        apply(topic, request);
        topic.setStatus(ContentStatus.DRAFT.name());
        topicMapper.insert(topic);
        return TopicDto.from(topic);
    }

    public TopicDto update(Long id, TopicUpsertRequest request) {
        Topic topic = topicMapper.selectById(id);
        if (topic == null) {
            throw new IllegalArgumentException("Topic not found");
        }
        apply(topic, request);
        topicMapper.updateById(topic);
        return TopicDto.from(topic);
    }

    public TopicDto updateStatus(Long id, ContentStatus status) {
        Topic topic = topicMapper.selectById(id);
        if (topic == null) {
            throw new IllegalArgumentException("Topic not found");
        }
        topic.setStatus(status.name());
        topicMapper.updateById(topic);
        return TopicDto.from(topic);
    }

    private void apply(Topic topic, TopicUpsertRequest request) {
        topic.setSlug(request.slug());
        topic.setTitle(request.title());
        topic.setSummary(request.summary());
        topic.setContent(request.content());
        topic.setTargetAudience(normalize(request.targetAudience(), topic.getTargetAudience(), "3-5 年 Java 后端工程师"));
        topic.setWhyImportant(normalize(request.whyImportant(), topic.getWhyImportant(), "详见正文。"));
        topic.setPrerequisites(normalize(request.prerequisites(), topic.getPrerequisites(), "详见正文。"));
        topic.setKnowledgeMap(normalize(request.knowledgeMap(), topic.getKnowledgeMap(), "详见正文。"));
        topic.setInterviewFocus(normalize(request.interviewFocus(), topic.getInterviewFocus(), request.summary()));
        topic.setSortOrder(request.sortOrder());
    }

    private String normalize(String value, String currentValue, String defaultValue) {
        if (value != null && !value.isBlank()) {
            return value.trim();
        }
        if (currentValue != null && !currentValue.isBlank()) {
            return currentValue;
        }
        return defaultValue;
    }
}
