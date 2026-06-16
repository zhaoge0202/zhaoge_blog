package cn.zhaoge.interview.question;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;

@TableName("project_mappings")
public class ProjectMapping {
    @TableId(type = IdType.AUTO)
    private Long id;
    private Long questionId;
    private String scenario;
    private String projectTalkingPoint;
    private String riskPoint;
    private String interviewAnswer;
    private Integer sortOrder;

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public Long getQuestionId() { return questionId; }
    public void setQuestionId(Long questionId) { this.questionId = questionId; }
    public String getScenario() { return scenario; }
    public void setScenario(String scenario) { this.scenario = scenario; }
    public String getProjectTalkingPoint() { return projectTalkingPoint; }
    public void setProjectTalkingPoint(String projectTalkingPoint) { this.projectTalkingPoint = projectTalkingPoint; }
    public String getRiskPoint() { return riskPoint; }
    public void setRiskPoint(String riskPoint) { this.riskPoint = riskPoint; }
    public String getInterviewAnswer() { return interviewAnswer; }
    public void setInterviewAnswer(String interviewAnswer) { this.interviewAnswer = interviewAnswer; }
    public Integer getSortOrder() { return sortOrder; }
    public void setSortOrder(Integer sortOrder) { this.sortOrder = sortOrder; }
}
