package cn.zhaoge.interview;

import org.mybatis.spring.annotation.MapperScan;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.context.properties.ConfigurationPropertiesScan;

@SpringBootApplication
@MapperScan("cn.zhaoge.interview.**.mapper")
@ConfigurationPropertiesScan
public class InterviewPlatformApplication {
    public static void main(String[] args) {
        SpringApplication.run(InterviewPlatformApplication.class, args);
    }
}
