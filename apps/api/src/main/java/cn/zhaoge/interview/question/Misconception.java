package cn.zhaoge.interview.question;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;

@TableName("misconceptions")
public class Misconception {
    @TableId(type = IdType.AUTO)
    private Long id;
    private Long questionId;
    private String wrongStatement;
    private String whyWrong;
    private String correctStatement;
    private Integer sortOrder;

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public Long getQuestionId() { return questionId; }
    public void setQuestionId(Long questionId) { this.questionId = questionId; }
    public String getWrongStatement() { return wrongStatement; }
    public void setWrongStatement(String wrongStatement) { this.wrongStatement = wrongStatement; }
    public String getWhyWrong() { return whyWrong; }
    public void setWhyWrong(String whyWrong) { this.whyWrong = whyWrong; }
    public String getCorrectStatement() { return correctStatement; }
    public void setCorrectStatement(String correctStatement) { this.correctStatement = correctStatement; }
    public Integer getSortOrder() { return sortOrder; }
    public void setSortOrder(Integer sortOrder) { this.sortOrder = sortOrder; }
}
