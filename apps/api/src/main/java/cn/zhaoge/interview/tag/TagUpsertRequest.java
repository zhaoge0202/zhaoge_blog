package cn.zhaoge.interview.tag;

import cn.zhaoge.interview.common.TagType;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

public record TagUpsertRequest(@NotBlank String name, @NotBlank String slug, @NotNull TagType type) {
}
