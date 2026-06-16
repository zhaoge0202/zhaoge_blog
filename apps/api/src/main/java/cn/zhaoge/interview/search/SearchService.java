package cn.zhaoge.interview.search;

import cn.zhaoge.interview.common.ContentStatus;
import cn.zhaoge.interview.note.PersonalNote;
import cn.zhaoge.interview.note.mapper.PersonalNoteMapper;
import cn.zhaoge.interview.question.Question;
import cn.zhaoge.interview.question.mapper.QuestionMapper;
import cn.zhaoge.interview.topic.Topic;
import cn.zhaoge.interview.topic.mapper.TopicMapper;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import java.util.List;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

@Service
public class SearchService {
    private static final int MAX_LIMIT = 20;

    private final TopicMapper topicMapper;
    private final QuestionMapper questionMapper;
    private final PersonalNoteMapper personalNoteMapper;

    public SearchService(TopicMapper topicMapper, QuestionMapper questionMapper, PersonalNoteMapper personalNoteMapper) {
        this.topicMapper = topicMapper;
        this.questionMapper = questionMapper;
        this.personalNoteMapper = personalNoteMapper;
    }

    public SearchResponseDto search(String keyword, int requestedLimit) {
        String normalizedKeyword = normalize(keyword);
        int limit = normalizeLimit(requestedLimit);
        List<SearchResultDto> topics = searchTopics(normalizedKeyword, limit);
        List<SearchResultDto> questions = searchQuestions(normalizedKeyword, limit);
        List<SearchResultDto> notes = searchNotes(normalizedKeyword, limit);
        return new SearchResponseDto(normalizedKeyword, topics, questions, notes, topics.size() + questions.size() + notes.size());
    }

    private List<SearchResultDto> searchTopics(String keyword, int limit) {
        LambdaQueryWrapper<Topic> wrapper = new LambdaQueryWrapper<Topic>()
                .eq(Topic::getStatus, ContentStatus.PUBLISHED.name())
                .orderByAsc(Topic::getSortOrder)
                .last("limit " + limit);
        if (StringUtils.hasText(keyword)) {
            wrapper.and(w -> w.like(Topic::getTitle, keyword)
                    .or().like(Topic::getSummary, keyword)
                    .or().like(Topic::getWhyImportant, keyword)
                    .or().like(Topic::getInterviewFocus, keyword));
        }
        return topicMapper.selectList(wrapper).stream()
                .map(topic -> new SearchResultDto(
                        "TOPIC",
                        topic.getId(),
                        topic.getSlug(),
                        topic.getTitle(),
                        topic.getSummary(),
                        "/topics/" + topic.getSlug(),
                        topic.getSortOrder()
                ))
                .toList();
    }

    private List<SearchResultDto> searchQuestions(String keyword, int limit) {
        LambdaQueryWrapper<Question> wrapper = new LambdaQueryWrapper<Question>()
                .eq(Question::getStatus, ContentStatus.PUBLISHED.name())
                .orderByAsc(Question::getSortOrder)
                .last("limit " + limit);
        if (StringUtils.hasText(keyword)) {
            wrapper.and(w -> w.like(Question::getTitle, keyword)
                    .or().like(Question::getSummary, keyword)
                    .or().like(Question::getShortAnswer, keyword)
                    .or().like(Question::getLongAnswer, keyword)
                    .or().like(Question::getDeepDive, keyword));
        }
        return questionMapper.selectList(wrapper).stream()
                .map(question -> new SearchResultDto(
                        "QUESTION",
                        question.getId(),
                        question.getSlug(),
                        question.getTitle(),
                        question.getSummary(),
                        "/questions/" + question.getSlug(),
                        question.getSortOrder()
                ))
                .toList();
    }

    private List<SearchResultDto> searchNotes(String keyword, int limit) {
        LambdaQueryWrapper<PersonalNote> wrapper = new LambdaQueryWrapper<PersonalNote>()
                .eq(PersonalNote::getStatus, ContentStatus.PUBLISHED.name())
                .orderByDesc(PersonalNote::getHappenedOn)
                .orderByAsc(PersonalNote::getSortOrder)
                .last("limit " + limit);
        if (StringUtils.hasText(keyword)) {
            wrapper.and(w -> w.like(PersonalNote::getTitle, keyword).or().like(PersonalNote::getContent, keyword));
        }
        return personalNoteMapper.selectList(wrapper).stream()
                .map(note -> new SearchResultDto(
                        "NOTE",
                        note.getId(),
                        null,
                        note.getTitle(),
                        note.getContent(),
                        "/journey",
                        note.getSortOrder()
                ))
                .toList();
    }

    private String normalize(String keyword) {
        return StringUtils.hasText(keyword) ? keyword.trim() : "";
    }

    private int normalizeLimit(int requestedLimit) {
        if (requestedLimit < 1) {
            return 5;
        }
        return Math.min(requestedLimit, MAX_LIMIT);
    }
}
