package cn.zhaoge.interview.search;

import cn.zhaoge.interview.common.ContentStatus;
import cn.zhaoge.interview.common.Difficulty;
import cn.zhaoge.interview.common.Frequency;
import cn.zhaoge.interview.common.MasteryLevel;
import cn.zhaoge.interview.common.NoteType;
import cn.zhaoge.interview.note.PersonalNote;
import cn.zhaoge.interview.note.mapper.PersonalNoteMapper;
import cn.zhaoge.interview.question.Question;
import cn.zhaoge.interview.question.mapper.QuestionMapper;
import cn.zhaoge.interview.topic.Topic;
import cn.zhaoge.interview.topic.mapper.TopicMapper;
import java.time.LocalDate;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.jdbc.Sql;
import org.springframework.test.web.servlet.MockMvc;

import static org.hamcrest.Matchers.hasSize;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
@Sql(
        scripts = {
                "/db/migration/V1__init_schema.sql",
                "/db/test/V1_1__topic_content_h2.sql"
        },
        executionPhase = Sql.ExecutionPhase.BEFORE_TEST_CLASS
)
class PublicSearchControllerTests {
    @Autowired
    private MockMvc mockMvc;
    @Autowired
    private TopicMapper topicMapper;
    @Autowired
    private QuestionMapper questionMapper;
    @Autowired
    private PersonalNoteMapper personalNoteMapper;

    @BeforeEach
    void setUp() {
        personalNoteMapper.delete(null);
        questionMapper.delete(null);
        topicMapper.delete(null);

        Topic topic = new Topic();
        topic.setSlug("mysql");
        topic.setTitle("MySQL");
        topic.setSummary("索引、事务、MVCC");
        topic.setContent("## 为什么重要\n\nMySQL 是项目深挖主战场");
        topic.setTargetAudience("3-5 年 Java 后端工程师");
        topic.setWhyImportant("MySQL 是项目深挖主战场");
        topic.setPrerequisites("SQL 基础");
        topic.setKnowledgeMap("索引 -> 事务 -> MVCC");
        topic.setInterviewFocus("能解释慢查询和一致性问题");
        topic.setSortOrder(10);
        topic.setStatus(ContentStatus.PUBLISHED.name());
        topicMapper.insert(topic);

        Question question = new Question();
        question.setTopicId(topic.getId());
        question.setSlug("mysql-mvcc");
        question.setTitle("MVCC 怎么理解？");
        question.setSummary("事务隔离级别高频题");
        question.setDifficulty(Difficulty.ADVANCED.name());
        question.setFrequency(Frequency.MUST_KNOW.name());
        question.setMasteryLevel(MasteryLevel.DEEP_EXPLAIN.name());
        question.setShortAnswer("MVCC 使用版本链和 ReadView");
        question.setLongAnswer("MVCC 解决一致性读问题");
        question.setDeepDive("undo log、隐藏字段、ReadView 共同工作");
        question.setAnswerStrategy("先讲隔离级别，再讲版本链");
        question.setSortOrder(10);
        question.setStatus(ContentStatus.PUBLISHED.name());
        questionMapper.insert(question);

        PersonalNote note = new PersonalNote();
        note.setTopicId(topic.getId());
        note.setNoteType(NoteType.REVISION.name());
        note.setTitle("纠偏 MVCC 背诵误区");
        note.setContent("不要把 MVCC 说成只靠快照完成");
        note.setHappenedOn(LocalDate.of(2026, 6, 16));
        note.setSortOrder(10);
        note.setStatus(ContentStatus.PUBLISHED.name());
        personalNoteMapper.insert(note);
    }

    @Test
    void searchReturnsPublishedTopicsQuestionsAndNotes() throws Exception {
        mockMvc.perform(get("/api/public/search").param("keyword", "MVCC").param("limit", "3"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.keyword").value("MVCC"))
                .andExpect(jsonPath("$.data.topics", hasSize(1)))
                .andExpect(jsonPath("$.data.questions", hasSize(1)))
                .andExpect(jsonPath("$.data.notes", hasSize(1)))
                .andExpect(jsonPath("$.data.questions[0].url").value("/questions/mysql-mvcc"))
                .andExpect(jsonPath("$.data.total").value(3));
    }
}
