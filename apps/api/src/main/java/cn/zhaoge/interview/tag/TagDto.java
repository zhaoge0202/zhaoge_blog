package cn.zhaoge.interview.tag;

public record TagDto(Long id, String name, String slug, String type) {
    public static TagDto from(Tag tag) {
        return new TagDto(tag.getId(), tag.getName(), tag.getSlug(), tag.getType());
    }
}
