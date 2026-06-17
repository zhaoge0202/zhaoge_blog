package cn.zhaoge.interview.export;

import cn.zhaoge.interview.note.PersonalNote;
import java.text.Normalizer;
import java.time.format.DateTimeFormatter;
import java.util.Objects;

public final class ExportPathHelper {
    private static final DateTimeFormatter DATE_FORMATTER = DateTimeFormatter.ISO_LOCAL_DATE;

    private ExportPathHelper() {
    }

    public static String buildNoteSlug(PersonalNote note) {
        return note.getHappenedOn().format(DATE_FORMATTER) + "-" + slugify(note.getTitle(), "note-" + note.getId());
    }

    private static String slugify(String value, String fallback) {
        String normalized = Normalizer.normalize(Objects.toString(value, ""), Normalizer.Form.NFD)
                .replaceAll("\\p{M}", "")
                .toLowerCase()
                .replaceAll("[^a-z0-9]+", "-")
                .replaceAll("(^-|-$)", "");
        return normalized.isBlank() ? fallback : normalized;
    }
}
