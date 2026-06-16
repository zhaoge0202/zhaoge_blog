package cn.zhaoge.interview.note;

import cn.zhaoge.interview.common.ContentStatus;
import cn.zhaoge.interview.note.mapper.PersonalNoteMapper;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import java.util.List;
import org.springframework.stereotype.Service;

@Service
public class PersonalNoteService {
    private final PersonalNoteMapper personalNoteMapper;

    public PersonalNoteService(PersonalNoteMapper personalNoteMapper) {
        this.personalNoteMapper = personalNoteMapper;
    }

    public List<PersonalNoteDto> listPublished() {
        return personalNoteMapper.selectList(new LambdaQueryWrapper<PersonalNote>()
                        .eq(PersonalNote::getStatus, ContentStatus.PUBLISHED.name())
                        .orderByDesc(PersonalNote::getHappenedOn)
                        .orderByAsc(PersonalNote::getSortOrder))
                .stream()
                .map(PersonalNoteDto::from)
                .toList();
    }

    public List<PersonalNoteDto> listAdmin() {
        return personalNoteMapper.selectList(new LambdaQueryWrapper<PersonalNote>()
                        .orderByDesc(PersonalNote::getHappenedOn)
                        .orderByAsc(PersonalNote::getSortOrder))
                .stream()
                .map(PersonalNoteDto::from)
                .toList();
    }

    public PersonalNoteDto create(PersonalNoteUpsertRequest request) {
        PersonalNote note = new PersonalNote();
        apply(note, request);
        note.setStatus(ContentStatus.DRAFT.name());
        personalNoteMapper.insert(note);
        return PersonalNoteDto.from(note);
    }

    public PersonalNoteDto update(Long id, PersonalNoteUpsertRequest request) {
        PersonalNote note = personalNoteMapper.selectById(id);
        if (note == null) {
            throw new IllegalArgumentException("Note not found");
        }
        apply(note, request);
        personalNoteMapper.updateById(note);
        return PersonalNoteDto.from(note);
    }

    public PersonalNoteDto updateStatus(Long id, ContentStatus status) {
        PersonalNote note = personalNoteMapper.selectById(id);
        if (note == null) {
            throw new IllegalArgumentException("Note not found");
        }
        note.setStatus(status.name());
        personalNoteMapper.updateById(note);
        return PersonalNoteDto.from(note);
    }

    private void apply(PersonalNote note, PersonalNoteUpsertRequest request) {
        note.setTopicId(request.topicId());
        note.setQuestionId(request.questionId());
        note.setNoteType(request.noteType().name());
        note.setTitle(request.title());
        note.setContent(request.content());
        note.setHappenedOn(request.happenedOn());
        note.setSortOrder(request.sortOrder());
    }
}
