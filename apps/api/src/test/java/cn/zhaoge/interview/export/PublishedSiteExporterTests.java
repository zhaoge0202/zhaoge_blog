package cn.zhaoge.interview.export;

import cn.zhaoge.interview.common.ContentStatus;
import cn.zhaoge.interview.common.Difficulty;
import cn.zhaoge.interview.common.Frequency;
import cn.zhaoge.interview.common.MasteryLevel;
import cn.zhaoge.interview.common.NoteType;
import cn.zhaoge.interview.common.SectionType;
import cn.zhaoge.interview.common.SourceType;
import cn.zhaoge.interview.note.PersonalNote;
import cn.zhaoge.interview.note.mapper.PersonalNoteMapper;
import cn.zhaoge.interview.question.mapper.CorrectionNoteMapper;
import cn.zhaoge.interview.question.mapper.FollowUpQuestionMapper;
import cn.zhaoge.interview.question.mapper.MisconceptionMapper;
import cn.zhaoge.interview.question.mapper.ProjectMappingMapper;
import cn.zhaoge.interview.question.mapper.QuestionMapper;
import cn.zhaoge.interview.question.mapper.QuestionSectionMapper;
import cn.zhaoge.interview.question.mapper.ReferenceSourceMapper;
import cn.zhaoge.interview.question.QuestionDetailDto;
import cn.zhaoge.interview.question.QuestionService;
import cn.zhaoge.interview.question.QuestionUpsertRequest;
import cn.zhaoge.interview.topic.Topic;
import cn.zhaoge.interview.topic.mapper.TopicMapper;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.time.LocalDate;
import java.util.Comparator;
import java.util.List;
import java.util.stream.Stream;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.context.jdbc.Sql;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

@SpringBootTest
@Sql(
        scripts = {
                "/db/migration/V1__init_schema.sql",
                "/db/test/V1_1__topic_content_h2.sql"
        },
        executionPhase = Sql.ExecutionPhase.BEFORE_TEST_CLASS
)
class PublishedSiteExporterTests {
    private static final Path EXPORT_ROOT = Paths.get("target/test-export-site").toAbsolutePath();

    @DynamicPropertySource
    static void exportProperties(DynamicPropertyRegistry registry) {
        registry.add("content-export.enabled", () -> true);
        registry.add("content-export.output-root", () -> EXPORT_ROOT.toString());
        registry.add("spring.datasource.url", () -> "jdbc:h2:mem:interview_platform_export;MODE=MySQL;DATABASE_TO_LOWER=TRUE;DB_CLOSE_DELAY=-1");
    }

    @Autowired
    private PublishedSiteExporter exporter;

    @Autowired
    private QuestionService questionService;

    @Autowired
    private TopicMapper topicMapper;

    @Autowired
    private PersonalNoteMapper personalNoteMapper;

    @Autowired
    private QuestionMapper questionMapper;

    @Autowired
    private QuestionSectionMapper questionSectionMapper;

    @Autowired
    private FollowUpQuestionMapper followUpQuestionMapper;

    @Autowired
    private MisconceptionMapper misconceptionMapper;

    @Autowired
    private CorrectionNoteMapper correctionNoteMapper;

    @Autowired
    private ProjectMappingMapper projectMappingMapper;

    @Autowired
    private ReferenceSourceMapper referenceSourceMapper;

    @BeforeEach
    void setUp() throws IOException {
        referenceSourceMapper.delete(null);
        projectMappingMapper.delete(null);
        correctionNoteMapper.delete(null);
        misconceptionMapper.delete(null);
        followUpQuestionMapper.delete(null);
        questionSectionMapper.delete(null);
        personalNoteMapper.delete(null);
        questionMapper.delete(null);
        topicMapper.delete(null);
        deleteRecursively(EXPORT_ROOT);
    }

    @Test
    void exportWritesPublishedTopicQuestionAndJourneyMarkdown() throws Exception {
        Topic topic = insertPublishedTopic("spring", "Spring", 10);
        QuestionDetailDto question = createQuestion(topic.getId(), "spring-transaction", "Spring 事务失效场景有哪些？", 10);
        questionService.updateStatus(question.id(), ContentStatus.PUBLISHED);

        PersonalNote note = new PersonalNote();
        note.setTopicId(topic.getId());
        note.setQuestionId(question.id());
        note.setNoteType(NoteType.REVISION.name());
        note.setTitle("Spring 事务第一轮复盘");
        note.setContent("以前只会背传播行为，现在开始按失效场景拆答案。");
        note.setHappenedOn(LocalDate.of(2026, 6, 17));
        note.setSortOrder(10);
        note.setStatus(ContentStatus.PUBLISHED.name());
        personalNoteMapper.insert(note);

        exporter.exportPublishedSite();

        Path home = EXPORT_ROOT.resolve("README.md");
        Path topicIndex = EXPORT_ROOT.resolve("topics/README.md");
        Path topicPage = EXPORT_ROOT.resolve("topics/spring/README.md");
        Path questionPage = EXPORT_ROOT.resolve("questions/spring/spring-transaction.md");

        assertTrue(Files.exists(home));
        assertTrue(Files.exists(topicIndex));
        assertTrue(Files.exists(topicPage));
        assertTrue(Files.exists(questionPage));

        String homeContent = Files.readString(home, StandardCharsets.UTF_8);
        String topicContent = Files.readString(topicPage, StandardCharsets.UTF_8);
        String questionContent = Files.readString(questionPage, StandardCharsets.UTF_8);

        assertTrue(homeContent.contains("Spring"));
        assertTrue(homeContent.contains("/questions/spring/spring-transaction.html"));
        assertTrue(topicContent.contains("Spring 事务失效场景有哪些？"));
        assertTrue(topicContent.contains("## 目标人群"));
        assertFalse(topicContent.contains("## 面向对象"));
        assertTrue(questionContent.contains("title: \"Spring 事务失效场景有哪些？\""));
        assertTrue(questionContent.contains("事务失效"));
        assertTrue(questionContent.contains("追问链路"));
        assertTrue(questionContent.contains("常见误区"));
        assertTrue(questionContent.contains("项目映射"));
        assertTrue(questionContent.contains("JavaGuide Spring 事务"));

        try (Stream<Path> stream = Files.list(EXPORT_ROOT.resolve("journey"))) {
            List<Path> notePages = stream
                    .filter(path -> path.getFileName().toString().endsWith(".md"))
                    .filter(path -> !path.getFileName().toString().equals("README.md"))
                    .toList();
            assertEquals(1, notePages.size());
            String noteContent = Files.readString(notePages.get(0), StandardCharsets.UTF_8);
            assertTrue(noteContent.contains("Spring 事务第一轮复盘"));
            assertTrue(noteContent.contains("/questions/spring/spring-transaction.html"));
        }
    }

    @Test
    void questionStatusTransitionCreatesAndRemovesExportedFile() throws Exception {
        Topic topic = insertPublishedTopic("mysql", "MySQL", 20);
        QuestionDetailDto question = createQuestion(topic.getId(), "mysql-mvcc-read-view", "MVCC 的 ReadView 何时创建？", 20);

        Path questionPage = EXPORT_ROOT.resolve("questions/mysql/mysql-mvcc-read-view.md");

        questionService.updateStatus(question.id(), ContentStatus.PUBLISHED);
        assertTrue(Files.exists(questionPage));

        questionService.updateStatus(question.id(), ContentStatus.DRAFT);
        assertFalse(Files.exists(questionPage));
    }

    @Test
    void exporterDoesNotDuplicateSectionsAlreadyPresentInTopicOrQuestionContent() throws Exception {
        Topic topic = insertPublishedTopic("juc", "JUC", 30);
        QuestionDetailDto question = createQuestion(topic.getId(), "juc-aqs", "AQS 的核心思路是什么？", 30);
        questionService.updateStatus(question.id(), ContentStatus.PUBLISHED);

        exporter.exportPublishedSite();

        String topicContent = Files.readString(EXPORT_ROOT.resolve("topics/juc/README.md"), StandardCharsets.UTF_8);
        String questionContent = Files.readString(EXPORT_ROOT.resolve("questions/juc/juc-aqs.md"), StandardCharsets.UTF_8);

        assertEquals(1, countOccurrences(topicContent, "## 为什么重要"));
        assertEquals(1, countOccurrences(questionContent, "## 30 秒回答"));
        assertEquals(1, countOccurrences(questionContent, "## 2 分钟回答"));
        assertEquals(1, countOccurrences(questionContent, "## 作答策略"));
        assertNotEquals(0, countOccurrences(questionContent, "## 追问链路"));
    }

    @Test
    void exportedQuestionPagesIncludePrevNextFrontmatter() throws Exception {
        Topic topic = insertPublishedTopic("spring", "Spring", 10);
        QuestionDetailDto firstQuestion = createQuestion(topic.getId(), "spring-transaction", "Spring 事务失效场景有哪些？", 10);
        QuestionDetailDto secondQuestion = createQuestion(topic.getId(), "spring-aop", "Spring AOP 代理怎么选择？", 20);
        questionService.updateStatus(firstQuestion.id(), ContentStatus.PUBLISHED);
        questionService.updateStatus(secondQuestion.id(), ContentStatus.PUBLISHED);

        exporter.exportPublishedSite();

        String firstContent = Files.readString(EXPORT_ROOT.resolve("questions/spring/spring-transaction.md"), StandardCharsets.UTF_8);
        String secondContent = Files.readString(EXPORT_ROOT.resolve("questions/spring/spring-aop.md"), StandardCharsets.UTF_8);

        assertFalse(firstContent.contains("prev:\n"));
        assertTrue(firstContent.contains("next:\n  text: \"Spring AOP 代理怎么选择？\"\n  link: \"/questions/spring/spring-aop.html\""));
        assertTrue(secondContent.contains("prev:\n  text: \"Spring 事务失效场景有哪些？\"\n  link: \"/questions/spring/spring-transaction.html\""));
        assertFalse(secondContent.contains("next:\n"));
    }

    private Topic insertPublishedTopic(String slug, String title, int sortOrder) {
        Topic topic = new Topic();
        topic.setSlug(slug);
        topic.setTitle(title);
        topic.setSummary(title + " 进阶专题");
        topic.setContent("## 为什么重要\n\n" + title + " 是高频专题。");
        topic.setTargetAudience("3-5 年 Java 后端工程师");
        topic.setWhyImportant(title + " 是项目深挖重点。");
        topic.setPrerequisites("基础概念");
        topic.setKnowledgeMap("主线拆解");
        topic.setInterviewFocus("能讲清楚原理和实战");
        topic.setSortOrder(sortOrder);
        topic.setStatus(ContentStatus.PUBLISHED.name());
        topicMapper.insert(topic);
        return topic;
    }

    private QuestionDetailDto createQuestion(Long topicId, String slug, String title, int sortOrder) {
        return questionService.create(new QuestionUpsertRequest(
                topicId,
                slug,
                title,
                "围绕事务失效和排查路径组织回答。",
                Difficulty.ADVANCED,
                Frequency.MUST_KNOW,
                MasteryLevel.PROJECT_READY,
                """
                ## 一句话回答

                事务失效最常见的根因，是代理没生效、异常没触发回滚、传播行为和线程边界被误用。

                ## 展开回答

                回答时先给失效分类，再给定位顺序。
                """,
                "先讲代理，再讲回滚边界。",
                "按代理、异常、传播行为、线程边界分组。",
                "补充自调用、private 方法、异步线程和 checked exception。",
                "先给一张分类图，再结合排查案例。",
                sortOrder,
                List.of(
                        new QuestionUpsertRequest.SectionRequest(
                                SectionType.PRINCIPLE,
                                "核心原理",
                                "Spring 事务依赖 AOP 代理与事务拦截器。",
                                10
                        )
                ),
                List.of(
                        new QuestionUpsertRequest.FollowUpRequest(
                                "为什么自调用会让事务失效？",
                                "因为调用没有经过代理对象。",
                                10
                        )
                ),
                List.of(
                        new QuestionUpsertRequest.MisconceptionRequest(
                                "只要加了 @Transactional 就一定生效。",
                                "代理、异常类型和线程边界都会影响事务。",
                                "要先确认调用链是否穿过代理，再看异常与传播行为。",
                                10
                        )
                ),
                List.of(
                        new QuestionUpsertRequest.CorrectionRequest(
                                "把失效原因按代理和边界拆开",
                                "以前只会背八种失效场景，排查顺序混乱。",
                                "先判断代理是否生效，再判断回滚与线程边界。",
                                "线上排查事务不回滚问题的复盘记录。",
                                SourceType.PERSONAL_REVIEW
                        )
                ),
                List.of(
                        new QuestionUpsertRequest.ProjectMappingRequest(
                                "订单写库 + 站内信异步发送",
                                "说明异步线程切走后事务上下文不会自动透传。",
                                "误以为异步方法还能共用外层事务。",
                                "我会把事务边界放在同步写库链路里，异步任务只消费最终结果。",
                                10
                        )
                ),
                List.of(
                        new QuestionUpsertRequest.ReferenceRequest(
                                "JavaGuide Spring 事务",
                                "https://javaguide.cn/system-design/framework/spring/spring-transaction.html",
                                SourceType.JAVAGUIDE,
                                "用于对照事务失效分类和传播行为。",
                                10
                        )
                )
        ));
    }

    private void deleteRecursively(Path path) throws IOException {
        if (!Files.exists(path)) {
            return;
        }
        try (Stream<Path> stream = Files.walk(path)) {
            stream.sorted(Comparator.reverseOrder()).forEach(current -> {
                try {
                    Files.deleteIfExists(current);
                } catch (IOException exception) {
                    throw new RuntimeException(exception);
                }
            });
        }
    }

    private int countOccurrences(String content, String needle) {
        return content.split(java.util.regex.Pattern.quote(needle), -1).length - 1;
    }
}
