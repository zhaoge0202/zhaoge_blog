package cn.zhaoge.interview.export;

import cn.zhaoge.interview.common.ContentStatus;
import cn.zhaoge.interview.note.PersonalNote;
import cn.zhaoge.interview.note.mapper.PersonalNoteMapper;
import cn.zhaoge.interview.question.CorrectionNote;
import cn.zhaoge.interview.question.FollowUpQuestion;
import cn.zhaoge.interview.question.Misconception;
import cn.zhaoge.interview.question.ProjectMapping;
import cn.zhaoge.interview.question.Question;
import cn.zhaoge.interview.question.QuestionSection;
import cn.zhaoge.interview.question.ReferenceSource;
import cn.zhaoge.interview.question.mapper.CorrectionNoteMapper;
import cn.zhaoge.interview.question.mapper.FollowUpQuestionMapper;
import cn.zhaoge.interview.question.mapper.MisconceptionMapper;
import cn.zhaoge.interview.question.mapper.ProjectMappingMapper;
import cn.zhaoge.interview.question.mapper.QuestionMapper;
import cn.zhaoge.interview.question.mapper.QuestionSectionMapper;
import cn.zhaoge.interview.question.mapper.ReferenceSourceMapper;
import cn.zhaoge.interview.topic.Topic;
import cn.zhaoge.interview.topic.mapper.TopicMapper;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.Collection;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.stream.Collectors;
import java.util.stream.Stream;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

@Service
@EnableConfigurationProperties(ContentExportProperties.class)
public class PublishedSiteExporter {
    private static final DateTimeFormatter DATE_FORMATTER = DateTimeFormatter.ISO_LOCAL_DATE;
    private static final List<String> MANAGED_PATHS = List.of("README.md", "topics", "questions", "journey");

    private final ContentExportProperties properties;
    private final TopicMapper topicMapper;
    private final QuestionMapper questionMapper;
    private final QuestionSectionMapper questionSectionMapper;
    private final FollowUpQuestionMapper followUpQuestionMapper;
    private final MisconceptionMapper misconceptionMapper;
    private final CorrectionNoteMapper correctionNoteMapper;
    private final ProjectMappingMapper projectMappingMapper;
    private final ReferenceSourceMapper referenceSourceMapper;
    private final PersonalNoteMapper personalNoteMapper;

    public PublishedSiteExporter(
            ContentExportProperties properties,
            TopicMapper topicMapper,
            QuestionMapper questionMapper,
            QuestionSectionMapper questionSectionMapper,
            FollowUpQuestionMapper followUpQuestionMapper,
            MisconceptionMapper misconceptionMapper,
            CorrectionNoteMapper correctionNoteMapper,
            ProjectMappingMapper projectMappingMapper,
            ReferenceSourceMapper referenceSourceMapper,
            PersonalNoteMapper personalNoteMapper
    ) {
        this.properties = properties;
        this.topicMapper = topicMapper;
        this.questionMapper = questionMapper;
        this.questionSectionMapper = questionSectionMapper;
        this.followUpQuestionMapper = followUpQuestionMapper;
        this.misconceptionMapper = misconceptionMapper;
        this.correctionNoteMapper = correctionNoteMapper;
        this.projectMappingMapper = projectMappingMapper;
        this.referenceSourceMapper = referenceSourceMapper;
        this.personalNoteMapper = personalNoteMapper;
    }

    public void exportPublishedSite() {
        if (!properties.isEnabled()) {
            return;
        }

        try {
            Path outputRoot = resolveOutputRoot();
            List<Topic> topics = listPublishedTopics();
            Map<Long, Topic> topicsById = topics.stream()
                    .collect(Collectors.toMap(Topic::getId, topic -> topic, (left, right) -> left, LinkedHashMap::new));
            List<ExportedQuestion> questions = listPublishedQuestions(topicsById.keySet());
            List<PersonalNote> notes = listPublishedNotes();

            resetManagedPaths(outputRoot);
            Files.createDirectories(outputRoot);
            Files.createDirectories(outputRoot.resolve("topics"));
            Files.createDirectories(outputRoot.resolve("questions"));
            Files.createDirectories(outputRoot.resolve("journey"));

            write(outputRoot.resolve("README.md"), buildHomePage(topics, questions, notes, topicsById));
            write(outputRoot.resolve("topics/README.md"), buildTopicIndexPage(topics));
            write(outputRoot.resolve("questions/README.md"), buildQuestionIndexPage(questions, topicsById));
            write(outputRoot.resolve("journey/README.md"), buildJourneyIndexPage(notes, topicsById, questions));

            Map<Long, List<ExportedQuestion>> questionsByTopic = questions.stream()
                    .collect(Collectors.groupingBy(question -> question.question().getTopicId(), LinkedHashMap::new, Collectors.toList()));

            for (int index = 0; index < topics.size(); index++) {
                Topic topic = topics.get(index);
                Path topicDir = outputRoot.resolve("topics").resolve(topic.getSlug());
                Files.createDirectories(topicDir);
                write(topicDir.resolve("README.md"), buildTopicPage(
                        topic,
                        questionsByTopic.getOrDefault(topic.getId(), List.of()),
                        topicNavigationLink(topics, index - 1),
                        topicNavigationLink(topics, index + 1)
                ));
            }

            for (int index = 0; index < questions.size(); index++) {
                ExportedQuestion question = questions.get(index);
                Topic topic = topicsById.get(question.question().getTopicId());
                if (topic == null) {
                    continue;
                }
                Path questionDir = outputRoot.resolve("questions").resolve(topic.getSlug());
                Files.createDirectories(questionDir);
                write(questionDir.resolve(question.question().getSlug() + ".md"), buildQuestionPage(
                        topic,
                        question,
                        questionNavigationLink(questions, topicsById, index - 1),
                        questionNavigationLink(questions, topicsById, index + 1)
                ));
            }

            Map<Long, ExportedQuestion> questionsById = questions.stream()
                    .collect(Collectors.toMap(question -> question.question().getId(), question -> question, (left, right) -> left, LinkedHashMap::new));

            for (int index = 0; index < notes.size(); index++) {
                PersonalNote note = notes.get(index);
                write(outputRoot.resolve("journey").resolve(ExportPathHelper.buildNoteSlug(note) + ".md"), buildJourneyPage(
                        note,
                        topicsById,
                        questionsById,
                        noteNavigationLink(notes, index - 1),
                        noteNavigationLink(notes, index + 1)
                ));
            }
        } catch (IOException exception) {
            throw new IllegalStateException("Failed to export published content", exception);
        }
    }

    private Path resolveOutputRoot() {
        Path configured = Path.of(properties.getOutputRoot());
        if (configured.isAbsolute()) {
            return configured.normalize();
        }
        return Path.of(System.getProperty("user.dir")).resolve(configured).normalize();
    }

    private void resetManagedPaths(Path outputRoot) throws IOException {
        for (String relativePath : MANAGED_PATHS) {
            deleteRecursively(outputRoot.resolve(relativePath));
        }
    }

    private void deleteRecursively(Path path) throws IOException {
        if (!Files.exists(path)) {
            return;
        }
        try (Stream<Path> stream = Files.walk(path)) {
            for (Path current : stream.sorted(Comparator.reverseOrder()).toList()) {
                Files.deleteIfExists(current);
            }
        }
    }

    private void write(Path file, String content) throws IOException {
        Files.createDirectories(file.getParent());
        Files.writeString(file, content, StandardCharsets.UTF_8);
    }

    private List<Topic> listPublishedTopics() {
        return topicMapper.selectList(new LambdaQueryWrapper<Topic>()
                .eq(Topic::getStatus, ContentStatus.PUBLISHED.name())
                .orderByAsc(Topic::getSortOrder)
                .orderByAsc(Topic::getId));
    }

    private List<ExportedQuestion> listPublishedQuestions(Collection<Long> publishedTopicIds) {
        if (publishedTopicIds.isEmpty()) {
            return List.of();
        }

        List<Question> questions = questionMapper.selectList(new LambdaQueryWrapper<Question>()
                .eq(Question::getStatus, ContentStatus.PUBLISHED.name())
                .in(Question::getTopicId, publishedTopicIds)
                .orderByAsc(Question::getSortOrder)
                .orderByAsc(Question::getId));

        List<ExportedQuestion> exportedQuestions = new ArrayList<>();
        for (Question question : questions) {
            Long questionId = question.getId();
            exportedQuestions.add(new ExportedQuestion(
                    question,
                    questionSectionMapper.selectList(new LambdaQueryWrapper<QuestionSection>()
                            .eq(QuestionSection::getQuestionId, questionId)
                            .orderByAsc(QuestionSection::getSortOrder)),
                    followUpQuestionMapper.selectList(new LambdaQueryWrapper<FollowUpQuestion>()
                            .eq(FollowUpQuestion::getQuestionId, questionId)
                            .orderByAsc(FollowUpQuestion::getSortOrder)),
                    misconceptionMapper.selectList(new LambdaQueryWrapper<Misconception>()
                            .eq(Misconception::getQuestionId, questionId)
                            .orderByAsc(Misconception::getSortOrder)),
                    correctionNoteMapper.selectList(new LambdaQueryWrapper<CorrectionNote>()
                            .eq(CorrectionNote::getQuestionId, questionId)
                            .orderByDesc(CorrectionNote::getUpdatedAt)
                            .orderByAsc(CorrectionNote::getId)),
                    projectMappingMapper.selectList(new LambdaQueryWrapper<ProjectMapping>()
                            .eq(ProjectMapping::getQuestionId, questionId)
                            .orderByAsc(ProjectMapping::getSortOrder)),
                    referenceSourceMapper.selectList(new LambdaQueryWrapper<ReferenceSource>()
                            .eq(ReferenceSource::getQuestionId, questionId)
                            .orderByAsc(ReferenceSource::getSortOrder))
            ));
        }
        return exportedQuestions;
    }

    private List<PersonalNote> listPublishedNotes() {
        return personalNoteMapper.selectList(new LambdaQueryWrapper<PersonalNote>()
                .eq(PersonalNote::getStatus, ContentStatus.PUBLISHED.name())
                .orderByDesc(PersonalNote::getHappenedOn)
                .orderByAsc(PersonalNote::getSortOrder)
                .orderByAsc(PersonalNote::getId));
    }

    private String buildHomePage(List<Topic> topics, List<ExportedQuestion> questions, List<PersonalNote> notes, Map<Long, Topic> topicsById) {
        StringBuilder highlights = new StringBuilder();
        for (Topic topic : topics.stream().limit(4).toList()) {
            highlights.append("      - title: ").append(yamlString(topic.getTitle())).append('\n')
                    .append("        details: ").append(yamlString(topic.getSummary())).append('\n')
                    .append("        link: ").append(yamlString(topicLink(topic))).append('\n');
        }

        StringBuilder latestQuestions = new StringBuilder();
        for (ExportedQuestion question : questions.stream().limit(8).toList()) {
            Topic topic = topicsById.get(question.question().getTopicId());
            if (topic == null) {
                continue;
            }
            latestQuestions.append("- [")
                    .append(question.question().getTitle())
                    .append("](")
                    .append(questionLink(topic, question.question()))
                    .append(") · ")
                    .append(topic.getTitle())
                    .append('\n');
        }

        StringBuilder latestNotes = new StringBuilder();
        for (PersonalNote note : notes.stream().limit(6).toList()) {
            latestNotes.append("- [")
                    .append(note.getTitle())
                    .append("](")
                    .append(journeyLink(note))
                    .append(") · ")
                    .append(note.getHappenedOn().format(DATE_FORMATTER))
                    .append('\n');
        }

        return """
                ---
                home: true
                title: "Java 面试进阶平台"
                heroText: "Java 面试进阶平台"
                tagline: "用专题、题目与复盘沉淀 3-5 年 Java 后端工程师的进阶面试准备"
                actions:
                  - text: "进入专题"
                    link: "/topics/"
                    type: "primary"
                  - text: "浏览题库"
                    link: "/questions/"
                    type: "default"
                highlights:
                  - header: "核心专题"
                    description: "围绕高频专题组织题目、误区、纠偏和项目映射。"
                    features:
                """
                + highlights
                + """

                ---

                ## 最新题目

                """
                + emptyFallback(latestQuestions, "- 暂无已发布题目\n")
                + """

                ## 最近复盘

                """
                + emptyFallback(latestNotes, "- 暂无已发布笔记\n");
    }

    private String buildTopicIndexPage(List<Topic> topics) {
        StringBuilder body = new StringBuilder("""
                ---
                title: "专题"
                article: false
                breadcrumb: true
                editLink: false
                ---

                # 专题

                """);

        if (topics.isEmpty()) {
            body.append("当前还没有已发布专题。\n");
            return body.toString();
        }

        for (Topic topic : topics) {
            body.append("- [")
                    .append(topic.getTitle())
                    .append("](")
                    .append(topicLink(topic))
                    .append(") - ")
                    .append(topic.getSummary())
                    .append('\n');
        }
        return body.toString();
    }

    private String buildQuestionIndexPage(List<ExportedQuestion> questions, Map<Long, Topic> topicsById) {
        StringBuilder body = new StringBuilder("""
                ---
                title: "题库"
                article: false
                breadcrumb: true
                editLink: false
                ---

                # 题库

                """);

        if (questions.isEmpty()) {
            body.append("当前还没有已发布题目。\n");
            return body.toString();
        }

        for (ExportedQuestion question : questions) {
            Topic topic = topicsById.get(question.question().getTopicId());
            if (topic == null) {
                continue;
            }
            body.append("- [")
                    .append(question.question().getTitle())
                    .append("](")
                    .append(questionLink(topic, question.question()))
                    .append(") · ")
                    .append(topic.getTitle())
                    .append(" · ")
                    .append(question.question().getSummary())
                    .append('\n');
        }
        return body.toString();
    }

    private String buildJourneyIndexPage(List<PersonalNote> notes, Map<Long, Topic> topicsById, List<ExportedQuestion> questions) {
        Map<Long, ExportedQuestion> questionsById = questions.stream()
                .collect(Collectors.toMap(question -> question.question().getId(), question -> question, (left, right) -> left, LinkedHashMap::new));

        StringBuilder body = new StringBuilder("""
                ---
                title: "心路历程"
                article: false
                breadcrumb: true
                editLink: false
                ---

                # 心路历程

                """);

        if (notes.isEmpty()) {
            body.append("当前还没有已发布笔记。\n");
            return body.toString();
        }

        for (PersonalNote note : notes) {
            body.append("- [")
                    .append(note.getTitle())
                    .append("](")
                    .append(journeyLink(note))
                    .append(") · ")
                    .append(note.getHappenedOn().format(DATE_FORMATTER));

            Topic topic = note.getTopicId() == null ? null : topicsById.get(note.getTopicId());
            ExportedQuestion question = note.getQuestionId() == null ? null : questionsById.get(note.getQuestionId());
            if (topic != null) {
                body.append(" · ").append(topic.getTitle());
            }
            if (question != null && topic != null) {
                body.append(" · [关联题目](").append(questionLink(topic, question.question())).append(')');
            }
            body.append('\n');
        }
        return body.toString();
    }

    private String buildTopicPage(Topic topic, List<ExportedQuestion> questions, NavigationLink prev, NavigationLink next) {
        StringBuilder body = new StringBuilder();
        body.append("---\n")
                .append("title: ").append(yamlString(topic.getTitle())).append('\n')
                .append("description: ").append(yamlString(topic.getSummary())).append('\n')
                .append("article: true\n")
                .append("breadcrumb: true\n")
                .append("editLink: false\n");
        appendNavigationFrontmatter(body, prev, next);
        body.append("---\n\n")
                .append("# ").append(topic.getTitle()).append("\n\n")
                .append(topic.getContent()).append("\n\n");

        appendSectionIfMissing(body, topic.getContent(), "目标人群", topic.getTargetAudience());
        appendSectionIfMissing(body, topic.getContent(), "为什么重要", topic.getWhyImportant());
        appendSectionIfMissing(body, topic.getContent(), "前置知识", topic.getPrerequisites());
        appendSectionIfMissing(body, topic.getContent(), "知识地图", topic.getKnowledgeMap());
        appendSectionIfMissing(body, topic.getContent(), "面试重点", topic.getInterviewFocus());
        body.append("## 题目列表\n\n");

        if (questions.isEmpty()) {
            body.append("当前专题下还没有已发布题目。\n");
        } else {
            for (ExportedQuestion question : questions) {
                body.append("- [")
                        .append(question.question().getTitle())
                        .append("](")
                        .append(questionLink(topic, question.question()))
                        .append(") - ")
                        .append(question.question().getSummary())
                        .append('\n');
            }
        }
        return body.toString();
    }

    private String buildQuestionPage(Topic topic, ExportedQuestion exportedQuestion, NavigationLink prev, NavigationLink next) {
        Question question = exportedQuestion.question();
        StringBuilder body = new StringBuilder();
        body.append("---\n")
                .append("title: ").append(yamlString(question.getTitle())).append('\n')
                .append("description: ").append(yamlString(question.getSummary())).append('\n')
                .append("breadcrumb: true\n")
                .append("article: true\n")
                .append("editLink: false\n")
                .append("category:\n")
                .append("  - ").append(yamlString(topic.getTitle())).append('\n')
                .append("tag:\n")
                .append("  - ").append(yamlString(question.getDifficulty())).append('\n')
                .append("  - ").append(yamlString(question.getFrequency())).append('\n')
                .append("  - ").append(yamlString(question.getMasteryLevel())).append('\n');
        appendNavigationFrontmatter(body, prev, next);
        body.append("---\n\n")
                .append("# ").append(question.getTitle()).append("\n\n")
                .append("> ").append(question.getSummary()).append("\n\n")
                .append(question.getContent()).append("\n\n")
                .append("## 题目信息\n\n")
                .append("- 专题：[").append(topic.getTitle()).append("](").append(topicLink(topic)).append(")\n")
                .append("- 难度：").append(question.getDifficulty()).append('\n')
                .append("- 高频程度：").append(question.getFrequency()).append('\n')
                .append("- 掌握层级：").append(question.getMasteryLevel()).append("\n\n");

        appendSectionIfMissing(body, question.getContent(), "30 秒回答", question.getShortAnswer());
        appendSectionIfMissing(body, question.getContent(), "2 分钟回答", question.getLongAnswer());
        appendSectionIfMissing(body, question.getContent(), "深度展开", question.getDeepDive());
        appendSectionIfMissing(body, question.getContent(), "作答策略", question.getAnswerStrategy());
        if (!exportedQuestion.sections().isEmpty()) {
            body.append("## 补充分节\n\n");
            for (QuestionSection section : exportedQuestion.sections()) {
                body.append("### ").append(section.getTitle()).append("\n\n")
                        .append(section.getContent()).append("\n\n");
            }
        }
        if (!exportedQuestion.followUps().isEmpty()) {
            body.append("## 追问链路\n\n");
            for (FollowUpQuestion followUp : exportedQuestion.followUps()) {
                body.append("- **").append(followUp.getQuestionText()).append("**：")
                        .append(followUp.getAnswerHint()).append('\n');
            }
            body.append('\n');
        }
        if (!exportedQuestion.misconceptions().isEmpty()) {
            body.append("## 常见误区\n\n");
            for (Misconception misconception : exportedQuestion.misconceptions()) {
                body.append("### ").append(misconception.getWrongStatement()).append("\n\n")
                        .append("- 为什么错：").append(misconception.getWhyWrong()).append('\n')
                        .append("- 正确说法：").append(misconception.getCorrectStatement()).append("\n\n");
            }
        }
        if (!exportedQuestion.corrections().isEmpty()) {
            body.append("## 纠偏记录\n\n");
            for (CorrectionNote correction : exportedQuestion.corrections()) {
                body.append("### ").append(correction.getTitle()).append("\n\n")
                        .append("- 问题：").append(correction.getProblem()).append('\n')
                        .append("- 修正：").append(correction.getCorrection()).append('\n')
                        .append("- 证据：").append(correction.getEvidence()).append('\n')
                        .append("- 来源：").append(correction.getSourceType()).append("\n\n");
            }
        }
        if (!exportedQuestion.projectMappings().isEmpty()) {
            body.append("## 项目映射\n\n");
            for (ProjectMapping mapping : exportedQuestion.projectMappings()) {
                body.append("### ").append(mapping.getScenario()).append("\n\n")
                        .append("- 项目表达：").append(mapping.getProjectTalkingPoint()).append('\n')
                        .append("- 风险点：").append(mapping.getRiskPoint()).append('\n')
                        .append("- 面试回答：").append(mapping.getInterviewAnswer()).append("\n\n");
            }
        }
        if (!exportedQuestion.references().isEmpty()) {
            body.append("## 参考资料\n\n");
            for (ReferenceSource reference : exportedQuestion.references()) {
                body.append("- [").append(reference.getSourceName()).append("](").append(reference.getSourceUrl()).append(")")
                        .append(" · ").append(reference.getUsageNote()).append('\n');
            }
        }
        return body.toString();
    }

    private String buildJourneyPage(
            PersonalNote note,
            Map<Long, Topic> topicsById,
            Map<Long, ExportedQuestion> questionsById,
            NavigationLink prev,
            NavigationLink next
    ) {
        StringBuilder body = new StringBuilder();
        body.append("---\n")
                .append("title: ").append(yamlString(note.getTitle())).append('\n')
                .append("description: ").append(yamlString(truncate(note.getContent(), 80))).append('\n')
                .append("date: ").append(note.getHappenedOn().format(DATE_FORMATTER)).append('\n')
                .append("article: true\n")
                .append("timeline: true\n")
                .append("editLink: false\n")
                .append("category:\n")
                .append("  - ").append(yamlString("心路历程")).append('\n')
                .append("tag:\n")
                .append("  - ").append(yamlString(note.getNoteType())).append('\n');
        appendNavigationFrontmatter(body, prev, next);
        body.append("---\n\n")
                .append("# ").append(note.getTitle()).append("\n\n")
                .append(note.getContent()).append("\n\n");

        Topic topic = note.getTopicId() == null ? null : topicsById.get(note.getTopicId());
        if (topic != null) {
            body.append("## 关联专题\n\n- [")
                    .append(topic.getTitle())
                    .append("](")
                    .append(topicLink(topic))
                    .append(")\n\n");
        }

        ExportedQuestion question = note.getQuestionId() == null ? null : questionsById.get(note.getQuestionId());
        if (topic != null && question != null) {
            body.append("## 关联题目\n\n- [")
                    .append(question.question().getTitle())
                    .append("](")
                    .append(questionLink(topic, question.question()))
                    .append(")\n\n");
        }

        return body.toString();
    }

    private String emptyFallback(StringBuilder builder, String fallback) {
        return builder.isEmpty() ? fallback : builder.toString();
    }

    private void appendNavigationFrontmatter(StringBuilder body, NavigationLink prev, NavigationLink next) {
        appendNavigationItem(body, "prev", prev);
        appendNavigationItem(body, "next", next);
    }

    private void appendNavigationItem(StringBuilder body, String key, NavigationLink link) {
        if (link == null) {
            return;
        }
        body.append(key).append(":\n")
                .append("  text: ").append(yamlString(link.text())).append('\n')
                .append("  link: ").append(yamlString(link.link())).append('\n');
    }

    private void appendSectionIfMissing(StringBuilder body, String existingContent, String heading, String content) {
        if (!StringUtils.hasText(content) || hasHeading(existingContent, heading) || containsContent(existingContent, content)) {
            return;
        }
        body.append("## ").append(heading).append("\n\n").append(content.trim()).append("\n\n");
    }

    private boolean hasHeading(String content, String heading) {
        return Objects.toString(content, "").lines()
                .map(String::trim)
                .anyMatch(line -> line.matches("#{2,6}\\s+" + java.util.regex.Pattern.quote(heading) + "\\s*"));
    }

    private boolean containsContent(String existingContent, String content) {
        return Objects.toString(existingContent, "").contains(content.trim());
    }

    private String topicLink(Topic topic) {
        return "/topics/" + topic.getSlug() + "/";
    }

    private NavigationLink topicNavigationLink(List<Topic> topics, int index) {
        if (index < 0 || index >= topics.size()) {
            return null;
        }
        Topic topic = topics.get(index);
        return new NavigationLink(topic.getTitle(), topicLink(topic));
    }

    private String questionLink(Topic topic, Question question) {
        return "/questions/" + topic.getSlug() + "/" + question.getSlug() + ".html";
    }

    private NavigationLink questionNavigationLink(List<ExportedQuestion> questions, Map<Long, Topic> topicsById, int index) {
        if (index < 0 || index >= questions.size()) {
            return null;
        }
        ExportedQuestion question = questions.get(index);
        Topic topic = topicsById.get(question.question().getTopicId());
        if (topic == null) {
            return null;
        }
        return new NavigationLink(question.question().getTitle(), questionLink(topic, question.question()));
    }

    private String journeyLink(PersonalNote note) {
        return "/journey/" + buildNoteSlug(note) + ".html";
    }

    private NavigationLink noteNavigationLink(List<PersonalNote> notes, int index) {
        if (index < 0 || index >= notes.size()) {
            return null;
        }
        PersonalNote note = notes.get(index);
        return new NavigationLink(note.getTitle(), journeyLink(note));
    }

    private String buildNoteSlug(PersonalNote note) {
        return ExportPathHelper.buildNoteSlug(note);
    }

    private String truncate(String value, int maxLength) {
        if (value == null || value.length() <= maxLength) {
            return Objects.toString(value, "");
        }
        return value.substring(0, maxLength) + "...";
    }

    private String yamlString(String value) {
        return "\"" + Objects.toString(value, "").replace("\\", "\\\\").replace("\"", "\\\"") + "\"";
    }

    private record NavigationLink(String text, String link) {
    }

    private record ExportedQuestion(
            Question question,
            List<QuestionSection> sections,
            List<FollowUpQuestion> followUps,
            List<Misconception> misconceptions,
            List<CorrectionNote> corrections,
            List<ProjectMapping> projectMappings,
            List<ReferenceSource> references
    ) {
    }
}
