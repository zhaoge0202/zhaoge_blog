package cn.zhaoge.interview.dashboard;

import cn.zhaoge.interview.common.ApiResponse;
import cn.zhaoge.interview.common.ContentStatus;
import cn.zhaoge.interview.note.PersonalNote;
import cn.zhaoge.interview.note.mapper.PersonalNoteMapper;
import cn.zhaoge.interview.question.Question;
import cn.zhaoge.interview.question.mapper.QuestionMapper;
import cn.zhaoge.interview.topic.Topic;
import cn.zhaoge.interview.topic.mapper.TopicMapper;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/admin/dashboard")
public class AdminDashboardController {
    private final TopicMapper topicMapper;
    private final QuestionMapper questionMapper;
    private final PersonalNoteMapper personalNoteMapper;

    public AdminDashboardController(TopicMapper topicMapper, QuestionMapper questionMapper, PersonalNoteMapper personalNoteMapper) {
        this.topicMapper = topicMapper;
        this.questionMapper = questionMapper;
        this.personalNoteMapper = personalNoteMapper;
    }

    @GetMapping
    public ApiResponse<DashboardStatsDto> stats() {
        long topicCount = topicMapper.selectCount(new LambdaQueryWrapper<Topic>());
        long questionCount = questionMapper.selectCount(new LambdaQueryWrapper<Question>());
        long draftQuestionCount = questionMapper.selectCount(new LambdaQueryWrapper<Question>()
                .eq(Question::getStatus, ContentStatus.DRAFT.name()));
        long noteCount = personalNoteMapper.selectCount(new LambdaQueryWrapper<PersonalNote>());
        return ApiResponse.ok(new DashboardStatsDto(topicCount, questionCount, draftQuestionCount, noteCount));
    }
}
