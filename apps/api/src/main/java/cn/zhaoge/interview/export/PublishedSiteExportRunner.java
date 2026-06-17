package cn.zhaoge.interview.export;

import org.springframework.boot.CommandLineRunner;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Service;

@Service
@ConditionalOnProperty(prefix = "content-export", name = "export-on-startup", havingValue = "true", matchIfMissing = true)
public class PublishedSiteExportRunner implements CommandLineRunner {
    private final PublishedSiteExporter publishedSiteExporter;

    public PublishedSiteExportRunner(PublishedSiteExporter publishedSiteExporter) {
        this.publishedSiteExporter = publishedSiteExporter;
    }

    @Override
    public void run(String... args) {
        publishedSiteExporter.exportPublishedSite();
    }
}
