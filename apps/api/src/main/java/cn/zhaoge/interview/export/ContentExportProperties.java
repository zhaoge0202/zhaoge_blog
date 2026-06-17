package cn.zhaoge.interview.export;

import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "content-export")
public class ContentExportProperties {
    private boolean enabled = true;
    private boolean exportOnStartup = true;
    private String outputRoot = "../web/src";

    public boolean isEnabled() {
        return enabled;
    }

    public void setEnabled(boolean enabled) {
        this.enabled = enabled;
    }

    public boolean isExportOnStartup() {
        return exportOnStartup;
    }

    public void setExportOnStartup(boolean exportOnStartup) {
        this.exportOnStartup = exportOnStartup;
    }

    public String getOutputRoot() {
        return outputRoot;
    }

    public void setOutputRoot(String outputRoot) {
        this.outputRoot = outputRoot;
    }
}
