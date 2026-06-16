package cn.zhaoge.interview.tag;

import cn.zhaoge.interview.tag.mapper.TagMapper;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import java.util.List;
import org.springframework.stereotype.Service;

@Service
public class TagService {
    private final TagMapper tagMapper;

    public TagService(TagMapper tagMapper) {
        this.tagMapper = tagMapper;
    }

    public List<TagDto> list() {
        return tagMapper.selectList(new LambdaQueryWrapper<Tag>().orderByAsc(Tag::getType).orderByAsc(Tag::getName))
                .stream()
                .map(TagDto::from)
                .toList();
    }

    public TagDto create(TagUpsertRequest request) {
        Tag tag = new Tag();
        apply(tag, request);
        tagMapper.insert(tag);
        return TagDto.from(tag);
    }

    public TagDto update(Long id, TagUpsertRequest request) {
        Tag tag = tagMapper.selectById(id);
        if (tag == null) {
            throw new IllegalArgumentException("Tag not found");
        }
        apply(tag, request);
        tagMapper.updateById(tag);
        return TagDto.from(tag);
    }

    private void apply(Tag tag, TagUpsertRequest request) {
        tag.setName(request.name());
        tag.setSlug(request.slug());
        tag.setType(request.type().name());
    }
}
