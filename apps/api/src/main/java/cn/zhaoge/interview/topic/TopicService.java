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
        topic.setTargetAudience(request.targetAudience());
        topic.setWhyImportant(request.whyImportant());
        topic.setPrerequisites(request.prerequisites());
        topic.setKnowledgeMap(request.knowledgeMap());
        topic.setInterviewFocus(request.interviewFocus());
        topic.setSortOrder(request.sortOrder());
    }
}
