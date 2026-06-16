package cn.zhaoge.interview.question;

import cn.zhaoge.interview.common.ContentStatus;
import cn.zhaoge.interview.common.PageResponse;
import cn.zhaoge.interview.question.mapper.CorrectionNoteMapper;
import cn.zhaoge.interview.question.mapper.FollowUpQuestionMapper;
import cn.zhaoge.interview.question.mapper.MisconceptionMapper;
import cn.zhaoge.interview.question.mapper.ProjectMappingMapper;
import cn.zhaoge.interview.question.mapper.QuestionMapper;
import cn.zhaoge.interview.question.mapper.QuestionSectionMapper;
import cn.zhaoge.interview.question.mapper.ReferenceSourceMapper;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.core.metadata.IPage;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import java.time.LocalDateTime;
import java.util.List;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

@Service
public class QuestionService {
    private final QuestionMapper questionMapper;
    private final QuestionSectionMapper sectionMapper;
    private final FollowUpQuestionMapper followUpMapper;
    private final MisconceptionMapper misconceptionMapper;
    private final CorrectionNoteMapper correctionMapper;
    private final ProjectMappingMapper projectMappingMapper;
    private final ReferenceSourceMapper referenceSourceMapper;

    public QuestionService(
            QuestionMapper questionMapper,
            QuestionSectionMapper sectionMapper,
            FollowUpQuestionMapper followUpMapper,
            MisconceptionMapper misconceptionMapper,
            CorrectionNoteMapper correctionMapper,
            ProjectMappingMapper projectMappingMapper,
            ReferenceSourceMapper referenceSourceMapper
    ) {
        this.questionMapper = questionMapper;
        this.sectionMapper = sectionMapper;
        this.followUpMapper = followUpMapper;
        this.misconceptionMapper = misconceptionMapper;
        this.correctionMapper = correctionMapper;
        this.projectMappingMapper = projectMappingMapper;
        this.referenceSourceMapper = referenceSourceMapper;
    }

    public PageResponse<QuestionSummaryDto> listPublished(Long topicId, String keyword, long page, long size) {
        LambdaQueryWrapper<Question> wrapper = baseListWrapper(topicId, keyword)
                .eq(Question::getStatus, ContentStatus.PUBLISHED.name());
        IPage<Question> result = questionMapper.selectPage(Page.of(page, size), wrapper);
        return new PageResponse<>(result.getRecords().stream().map(QuestionSummaryDto::from).toList(), result.getTotal(), page, size);
    }

    public PageResponse<QuestionSummaryDto> listAdmin(Long topicId, String status, String keyword, long page, long size) {
        LambdaQueryWrapper<Question> wrapper = baseListWrapper(topicId, keyword);
        if (StringUtils.hasText(status)) {
            wrapper.eq(Question::getStatus, status);
        }
        IPage<Question> result = questionMapper.selectPage(Page.of(page, size), wrapper);
        return new PageResponse<>(result.getRecords().stream().map(QuestionSummaryDto::from).toList(), result.getTotal(), page, size);
    }

    public QuestionDetailDto getPublishedBySlug(String slug) {
        Question question = questionMapper.selectOne(new LambdaQueryWrapper<Question>()
                .eq(Question::getSlug, slug)
                .eq(Question::getStatus, ContentStatus.PUBLISHED.name()));
        if (question == null) {
            throw new IllegalArgumentException("Question not found");
        }
        return detail(question);
    }

    public QuestionDetailDto getAdminById(Long id) {
        Question question = questionMapper.selectById(id);
        if (question == null) {
            throw new IllegalArgumentException("Question not found");
        }
        return detail(question);
    }

    @Transactional
    public QuestionDetailDto create(QuestionUpsertRequest request) {
        Question question = new Question();
        apply(question, request);
        question.setStatus(ContentStatus.DRAFT.name());
        questionMapper.insert(question);
        replaceChildren(question.getId(), request);
        return getAdminById(question.getId());
    }

    @Transactional
    public QuestionDetailDto update(Long id, QuestionUpsertRequest request) {
        Question question = questionMapper.selectById(id);
        if (question == null) {
            throw new IllegalArgumentException("Question not found");
        }
        apply(question, request);
        questionMapper.updateById(question);
        replaceChildren(id, request);
        return getAdminById(id);
    }

    public QuestionDetailDto updateStatus(Long id, ContentStatus status) {
        Question question = questionMapper.selectById(id);
        if (question == null) {
            throw new IllegalArgumentException("Question not found");
        }
        question.setStatus(status.name());
        if (status == ContentStatus.PUBLISHED && question.getPublishedAt() == null) {
            question.setPublishedAt(LocalDateTime.now());
        }
        questionMapper.updateById(question);
        return getAdminById(id);
    }

    private LambdaQueryWrapper<Question> baseListWrapper(Long topicId, String keyword) {
        LambdaQueryWrapper<Question> wrapper = new LambdaQueryWrapper<Question>()
                .orderByAsc(Question::getSortOrder)
                .orderByDesc(Question::getUpdatedAt);
        if (topicId != null) {
            wrapper.eq(Question::getTopicId, topicId);
        }
        if (StringUtils.hasText(keyword)) {
            wrapper.and(w -> w.like(Question::getTitle, keyword).or().like(Question::getSummary, keyword));
        }
        return wrapper;
    }

    private QuestionDetailDto detail(Question question) {
        Long questionId = question.getId();
        return QuestionDetailDto.from(
                question,
                listSections(questionId),
                listFollowUps(questionId),
                listMisconceptions(questionId),
                listCorrections(questionId),
                listProjectMappings(questionId),
                listReferences(questionId)
        );
    }

    private List<QuestionSection> listSections(Long questionId) {
        return sectionMapper.selectList(new LambdaQueryWrapper<QuestionSection>()
                .eq(QuestionSection::getQuestionId, questionId)
                .orderByAsc(QuestionSection::getSortOrder));
    }

    private List<FollowUpQuestion> listFollowUps(Long questionId) {
        return followUpMapper.selectList(new LambdaQueryWrapper<FollowUpQuestion>()
                .eq(FollowUpQuestion::getQuestionId, questionId)
                .orderByAsc(FollowUpQuestion::getSortOrder));
    }

    private List<Misconception> listMisconceptions(Long questionId) {
        return misconceptionMapper.selectList(new LambdaQueryWrapper<Misconception>()
                .eq(Misconception::getQuestionId, questionId)
                .orderByAsc(Misconception::getSortOrder));
    }

    private List<CorrectionNote> listCorrections(Long questionId) {
        return correctionMapper.selectList(new LambdaQueryWrapper<CorrectionNote>()
                .eq(CorrectionNote::getQuestionId, questionId)
                .orderByDesc(CorrectionNote::getUpdatedAt));
    }

    private List<ProjectMapping> listProjectMappings(Long questionId) {
        return projectMappingMapper.selectList(new LambdaQueryWrapper<ProjectMapping>()
                .eq(ProjectMapping::getQuestionId, questionId)
                .orderByAsc(ProjectMapping::getSortOrder));
    }

    private List<ReferenceSource> listReferences(Long questionId) {
        return referenceSourceMapper.selectList(new LambdaQueryWrapper<ReferenceSource>()
                .eq(ReferenceSource::getQuestionId, questionId)
                .orderByAsc(ReferenceSource::getSortOrder));
    }

    private void apply(Question question, QuestionUpsertRequest request) {
        question.setTopicId(request.topicId());
        question.setSlug(request.slug());
        question.setTitle(request.title());
        question.setSummary(request.summary());
        question.setDifficulty(request.difficulty().name());
        question.setFrequency(request.frequency().name());
        question.setMasteryLevel(request.masteryLevel().name());
        question.setShortAnswer(request.shortAnswer());
        question.setLongAnswer(request.longAnswer());
        question.setDeepDive(request.deepDive());
        question.setAnswerStrategy(request.answerStrategy());
        question.setSortOrder(request.sortOrder());
    }

    private void replaceChildren(Long questionId, QuestionUpsertRequest request) {
        sectionMapper.delete(new LambdaQueryWrapper<QuestionSection>().eq(QuestionSection::getQuestionId, questionId));
        followUpMapper.delete(new LambdaQueryWrapper<FollowUpQuestion>().eq(FollowUpQuestion::getQuestionId, questionId));
        misconceptionMapper.delete(new LambdaQueryWrapper<Misconception>().eq(Misconception::getQuestionId, questionId));
        correctionMapper.delete(new LambdaQueryWrapper<CorrectionNote>().eq(CorrectionNote::getQuestionId, questionId));
        projectMappingMapper.delete(new LambdaQueryWrapper<ProjectMapping>().eq(ProjectMapping::getQuestionId, questionId));
        referenceSourceMapper.delete(new LambdaQueryWrapper<ReferenceSource>().eq(ReferenceSource::getQuestionId, questionId));

        nullSafe(request.sections()).forEach(item -> {
            QuestionSection section = new QuestionSection();
            section.setQuestionId(questionId);
            section.setSectionType(item.sectionType().name());
            section.setTitle(item.title());
            section.setContent(item.content());
            section.setSortOrder(item.sortOrder());
            sectionMapper.insert(section);
        });
        nullSafe(request.followUps()).forEach(item -> {
            FollowUpQuestion followUp = new FollowUpQuestion();
            followUp.setQuestionId(questionId);
            followUp.setQuestionText(item.questionText());
            followUp.setAnswerHint(item.answerHint());
            followUp.setSortOrder(item.sortOrder());
            followUpMapper.insert(followUp);
        });
        nullSafe(request.misconceptions()).forEach(item -> {
            Misconception misconception = new Misconception();
            misconception.setQuestionId(questionId);
            misconception.setWrongStatement(item.wrongStatement());
            misconception.setWhyWrong(item.whyWrong());
            misconception.setCorrectStatement(item.correctStatement());
            misconception.setSortOrder(item.sortOrder());
            misconceptionMapper.insert(misconception);
        });
        nullSafe(request.corrections()).forEach(item -> {
            CorrectionNote correction = new CorrectionNote();
            correction.setQuestionId(questionId);
            correction.setTitle(item.title());
            correction.setProblem(item.problem());
            correction.setCorrection(item.correction());
            correction.setEvidence(item.evidence());
            correction.setSourceType(item.sourceType().name());
            correctionMapper.insert(correction);
        });
        nullSafe(request.projectMappings()).forEach(item -> {
            ProjectMapping mapping = new ProjectMapping();
            mapping.setQuestionId(questionId);
            mapping.setScenario(item.scenario());
            mapping.setProjectTalkingPoint(item.projectTalkingPoint());
            mapping.setRiskPoint(item.riskPoint());
            mapping.setInterviewAnswer(item.interviewAnswer());
            mapping.setSortOrder(item.sortOrder());
            projectMappingMapper.insert(mapping);
        });
        nullSafe(request.references()).forEach(item -> {
            ReferenceSource reference = new ReferenceSource();
            reference.setQuestionId(questionId);
            reference.setSourceName(item.sourceName());
            reference.setSourceUrl(item.sourceUrl());
            reference.setSourceType(item.sourceType().name());
            reference.setUsageNote(item.usageNote());
            reference.setSortOrder(item.sortOrder());
            referenceSourceMapper.insert(reference);
        });
    }

    private <T> List<T> nullSafe(List<T> items) {
        return items == null ? List.of() : items;
    }
}
