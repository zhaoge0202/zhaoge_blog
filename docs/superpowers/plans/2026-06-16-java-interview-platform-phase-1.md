# Java 面试进阶平台 Phase 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the first runnable slice of the Java interview platform: Spring Boot API, MySQL schema, Next.js public site shell, and Vue admin shell.

**Architecture:** Use a small monorepo with three applications: `apps/api` for Spring Boot, `apps/web` for the public Next.js site, and `apps/admin` for the Vue admin console. The backend owns data, auth, validation, and public/admin API boundaries; both frontends consume the same backend through typed API wrappers.

**Tech Stack:** Spring Boot 3, Java 21, Maven, MyBatis Plus, Flyway, MySQL 8, Next.js, TypeScript, Vue 3, Vite, Pinia, Axios.

---

## File Structure

Create this layout:

```text
apps/
  api/
    pom.xml
    src/main/java/cn/zhaoge/interview/InterviewPlatformApplication.java
    src/main/java/cn/zhaoge/interview/common/
    src/main/java/cn/zhaoge/interview/auth/
    src/main/java/cn/zhaoge/interview/topic/
    src/main/java/cn/zhaoge/interview/question/
    src/main/java/cn/zhaoge/interview/tag/
    src/main/java/cn/zhaoge/interview/note/
    src/main/resources/application.yml
    src/main/resources/db/migration/V1__init_schema.sql
    src/test/java/cn/zhaoge/interview/
  web/
    package.json
    next.config.ts
    src/app/
    src/components/
    src/lib/api.ts
  admin/
    package.json
    vite.config.ts
    src/main.ts
    src/router/
    src/stores/
    src/views/
docs/
  superpowers/
    specs/
    plans/
```

Backend package responsibilities:

- `common`: response wrapper, paging model, exception handling, enums.
- `auth`: admin login, JWT issuing, password hashing, auth filter.
- `topic`: topic entity, mapper, service, public controller, admin controller.
- `question`: question aggregate, sections, follow-ups, misconceptions, corrections, project mappings, references.
- `tag`: tag CRUD and question-tag relation.
- `note`: personal note timeline.

Frontend responsibilities:

- `apps/web`: public reader experience, SEO-ready routes, read-only content.
- `apps/admin`: admin login and content CRUD workflows.

## Task 1: Scaffold Repository Conventions

**Files:**
- Create: `.gitignore`
- Create: `README.md`
- Create: `apps/.gitkeep`
- Create: `docs/architecture.md`

- [ ] **Step 1: Add gitignore**

Create `.gitignore`:

```gitignore
.DS_Store
.idea/
.vscode/
target/
node_modules/
dist/
.next/
coverage/
*.log
.env
.env.local
```

- [ ] **Step 2: Add root README**

Create `README.md`:

```md
# Java 面试进阶平台

面向 3-5 年 Java 后端工程师的进阶面试准备平台。

## Applications

- `apps/api`: Spring Boot backend.
- `apps/web`: Next.js public site.
- `apps/admin`: Vue admin console.

## V1 Scope

V1 focuses on four topics: 并发、JVM、MySQL、Redis.
```

- [ ] **Step 3: Add architecture note**

Create `docs/architecture.md`:

```md
# Architecture

The platform uses one Spring Boot backend and two frontends.

- The public Next.js site reads published topics, questions, and notes.
- The Vue admin console creates and publishes content.
- MySQL stores structured interview content.
- The backend separates public APIs under `/api/public/**` and admin APIs under `/api/admin/**`.
```

- [ ] **Step 4: Verify files**

Run: `rg --files`

Expected: root conventions and docs files appear.

## Task 2: Create Spring Boot API Skeleton

**Files:**
- Create: `apps/api/pom.xml`
- Create: `apps/api/src/main/java/cn/zhaoge/interview/InterviewPlatformApplication.java`
- Create: `apps/api/src/main/resources/application.yml`
- Create: `apps/api/src/test/java/cn/zhaoge/interview/InterviewPlatformApplicationTests.java`

- [ ] **Step 1: Create Maven project**

Create `apps/api/pom.xml`:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<project xmlns="http://maven.apache.org/POM/4.0.0"
         xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
         xsi:schemaLocation="http://maven.apache.org/POM/4.0.0 https://maven.apache.org/xsd/maven-4.0.0.xsd">
    <modelVersion>4.0.0</modelVersion>

    <groupId>cn.zhaoge</groupId>
    <artifactId>interview-platform-api</artifactId>
    <version>0.1.0-SNAPSHOT</version>
    <name>interview-platform-api</name>

    <properties>
        <java.version>21</java.version>
        <spring-boot.version>3.3.7</spring-boot.version>
        <mybatis-plus.version>3.5.7</mybatis-plus.version>
        <jjwt.version>0.12.6</jjwt.version>
    </properties>

    <dependencyManagement>
        <dependencies>
            <dependency>
                <groupId>org.springframework.boot</groupId>
                <artifactId>spring-boot-dependencies</artifactId>
                <version>${spring-boot.version}</version>
                <type>pom</type>
                <scope>import</scope>
            </dependency>
        </dependencies>
    </dependencyManagement>

    <dependencies>
        <dependency>
            <groupId>org.springframework.boot</groupId>
            <artifactId>spring-boot-starter-web</artifactId>
        </dependency>
        <dependency>
            <groupId>org.springframework.boot</groupId>
            <artifactId>spring-boot-starter-validation</artifactId>
        </dependency>
        <dependency>
            <groupId>org.springframework.boot</groupId>
            <artifactId>spring-boot-starter-security</artifactId>
        </dependency>
        <dependency>
            <groupId>com.baomidou</groupId>
            <artifactId>mybatis-plus-spring-boot3-starter</artifactId>
            <version>${mybatis-plus.version}</version>
        </dependency>
        <dependency>
            <groupId>org.flywaydb</groupId>
            <artifactId>flyway-core</artifactId>
        </dependency>
        <dependency>
            <groupId>org.flywaydb</groupId>
            <artifactId>flyway-mysql</artifactId>
        </dependency>
        <dependency>
            <groupId>com.mysql</groupId>
            <artifactId>mysql-connector-j</artifactId>
            <scope>runtime</scope>
        </dependency>
        <dependency>
            <groupId>io.jsonwebtoken</groupId>
            <artifactId>jjwt-api</artifactId>
            <version>${jjwt.version}</version>
        </dependency>
        <dependency>
            <groupId>io.jsonwebtoken</groupId>
            <artifactId>jjwt-impl</artifactId>
            <version>${jjwt.version}</version>
            <scope>runtime</scope>
        </dependency>
        <dependency>
            <groupId>io.jsonwebtoken</groupId>
            <artifactId>jjwt-jackson</artifactId>
            <version>${jjwt.version}</version>
            <scope>runtime</scope>
        </dependency>
        <dependency>
            <groupId>org.springframework.boot</groupId>
            <artifactId>spring-boot-starter-test</artifactId>
            <scope>test</scope>
        </dependency>
    </dependencies>

    <build>
        <plugins>
            <plugin>
                <groupId>org.springframework.boot</groupId>
                <artifactId>spring-boot-maven-plugin</artifactId>
                <version>${spring-boot.version}</version>
            </plugin>
        </plugins>
    </build>
</project>
```

- [ ] **Step 2: Create application class**

Create `apps/api/src/main/java/cn/zhaoge/interview/InterviewPlatformApplication.java`:

```java
package cn.zhaoge.interview;

import org.mybatis.spring.annotation.MapperScan;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

@SpringBootApplication
@MapperScan("cn.zhaoge.interview.**.mapper")
public class InterviewPlatformApplication {
    public static void main(String[] args) {
        SpringApplication.run(InterviewPlatformApplication.class, args);
    }
}
```

- [ ] **Step 3: Create application config**

Create `apps/api/src/main/resources/application.yml`:

```yaml
server:
  port: 8080

spring:
  profiles:
    default: local
  application:
    name: interview-platform-api
  datasource:
    url: ${DB_URL:jdbc:mysql://localhost:3306/interview_platform?useUnicode=true&characterEncoding=utf8&useSSL=false&serverTimezone=Asia/Shanghai}
    username: ${DB_USERNAME:root}
    password: ${DB_PASSWORD:123456}
  flyway:
    enabled: true
    locations: classpath:db/migration

mybatis-plus:
  configuration:
    map-underscore-to-camel-case: true

app:
  bootstrap-admin:
    enabled: true
    username: ${ADMIN_USERNAME:admin}
    password: ${ADMIN_PASSWORD:admin123456}
    display-name: ${ADMIN_DISPLAY_NAME:管理员}
  jwt:
    secret: ${JWT_SECRET:change-this-secret-to-at-least-32-characters}
    ttl-minutes: ${JWT_TTL_MINUTES:720}
```

Create `apps/api/src/main/resources/application-prod.yml` and keep production secrets in environment variables:

```yaml
spring:
  datasource:
    url: ${DB_URL}
    username: ${DB_USERNAME}
    password: ${DB_PASSWORD}

app:
  bootstrap-admin:
    enabled: ${BOOTSTRAP_ADMIN_ENABLED:false}
    username: ${ADMIN_USERNAME}
    password: ${ADMIN_PASSWORD}
    display-name: ${ADMIN_DISPLAY_NAME:管理员}
  jwt:
    secret: ${JWT_SECRET}
    ttl-minutes: ${JWT_TTL_MINUTES:720}
```

- [ ] **Step 4: Add context test**

Create `apps/api/src/test/java/cn/zhaoge/interview/InterviewPlatformApplicationTests.java`:

```java
package cn.zhaoge.interview;

import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.SpringBootTest;

@SpringBootTest
class InterviewPlatformApplicationTests {
    @Test
    void contextLoads() {
    }
}
```

- [ ] **Step 5: Compile backend**

Run: `cd apps/api && mvn test -DskipTests`

Expected: Maven compiles the project.

## Task 3: Add Database Migration

**Files:**
- Create: `apps/api/src/main/resources/db/migration/V1__init_schema.sql`

- [ ] **Step 1: Create schema migration**

Create `apps/api/src/main/resources/db/migration/V1__init_schema.sql`:

```sql
create table admin_users (
  id bigint primary key auto_increment,
  username varchar(64) not null unique,
  password_hash varchar(128) not null,
  display_name varchar(64) not null,
  enabled tinyint(1) not null default 1,
  created_at datetime not null default current_timestamp,
  updated_at datetime not null default current_timestamp on update current_timestamp
);

create table topics (
  id bigint primary key auto_increment,
  slug varchar(120) not null unique,
  title varchar(120) not null,
  summary varchar(500) not null,
  target_audience varchar(255) not null,
  why_important text not null,
  prerequisites text not null,
  knowledge_map text not null,
  interview_focus text not null,
  sort_order int not null default 0,
  status varchar(32) not null,
  created_at datetime not null default current_timestamp,
  updated_at datetime not null default current_timestamp on update current_timestamp
);

create table questions (
  id bigint primary key auto_increment,
  topic_id bigint not null,
  slug varchar(160) not null unique,
  title varchar(200) not null,
  summary varchar(500) not null,
  difficulty varchar(32) not null,
  frequency varchar(32) not null,
  mastery_level varchar(32) not null,
  short_answer text not null,
  long_answer text not null,
  deep_dive text not null,
  answer_strategy text not null,
  sort_order int not null default 0,
  status varchar(32) not null,
  published_at datetime null,
  created_at datetime not null default current_timestamp,
  updated_at datetime not null default current_timestamp on update current_timestamp,
  constraint fk_questions_topic foreign key (topic_id) references topics(id)
);

create index idx_questions_topic_id on questions(topic_id);
create index idx_questions_status on questions(status);
create index idx_questions_title on questions(title);

create table question_sections (
  id bigint primary key auto_increment,
  question_id bigint not null,
  section_type varchar(32) not null,
  title varchar(160) not null,
  content text not null,
  sort_order int not null default 0,
  created_at datetime not null default current_timestamp,
  updated_at datetime not null default current_timestamp on update current_timestamp,
  constraint fk_question_sections_question foreign key (question_id) references questions(id)
);

create table follow_up_questions (
  id bigint primary key auto_increment,
  question_id bigint not null,
  question_text varchar(500) not null,
  answer_hint text not null,
  sort_order int not null default 0,
  constraint fk_follow_up_questions_question foreign key (question_id) references questions(id)
);

create table misconceptions (
  id bigint primary key auto_increment,
  question_id bigint not null,
  wrong_statement varchar(500) not null,
  why_wrong text not null,
  correct_statement text not null,
  sort_order int not null default 0,
  constraint fk_misconceptions_question foreign key (question_id) references questions(id)
);

create table correction_notes (
  id bigint primary key auto_increment,
  question_id bigint not null,
  title varchar(160) not null,
  problem text not null,
  correction text not null,
  evidence text not null,
  source_type varchar(32) not null,
  created_at datetime not null default current_timestamp,
  updated_at datetime not null default current_timestamp on update current_timestamp,
  constraint fk_correction_notes_question foreign key (question_id) references questions(id)
);

create table project_mappings (
  id bigint primary key auto_increment,
  question_id bigint not null,
  scenario varchar(500) not null,
  project_talking_point text not null,
  risk_point text not null,
  interview_answer text not null,
  sort_order int not null default 0,
  constraint fk_project_mappings_question foreign key (question_id) references questions(id)
);

create table personal_notes (
  id bigint primary key auto_increment,
  topic_id bigint null,
  question_id bigint null,
  note_type varchar(32) not null,
  title varchar(160) not null,
  content text not null,
  happened_on date not null,
  sort_order int not null default 0,
  status varchar(32) not null,
  created_at datetime not null default current_timestamp,
  updated_at datetime not null default current_timestamp on update current_timestamp,
  constraint fk_personal_notes_topic foreign key (topic_id) references topics(id),
  constraint fk_personal_notes_question foreign key (question_id) references questions(id)
);

create index idx_personal_notes_happened_on on personal_notes(happened_on);

create table reference_sources (
  id bigint primary key auto_increment,
  question_id bigint null,
  topic_id bigint null,
  source_name varchar(120) not null,
  source_url varchar(500) not null,
  source_type varchar(32) not null,
  usage_note varchar(500) not null,
  sort_order int not null default 0,
  constraint fk_reference_sources_question foreign key (question_id) references questions(id),
  constraint fk_reference_sources_topic foreign key (topic_id) references topics(id)
);

create table tags (
  id bigint primary key auto_increment,
  name varchar(64) not null,
  slug varchar(80) not null unique,
  type varchar(32) not null
);

create table question_tags (
  question_id bigint not null,
  tag_id bigint not null,
  primary key (question_id, tag_id),
  constraint fk_question_tags_question foreign key (question_id) references questions(id),
  constraint fk_question_tags_tag foreign key (tag_id) references tags(id)
);
```

- [ ] **Step 2: Validate SQL file exists**

Run: `rg -n "create table topics|create table questions" apps/api/src/main/resources/db/migration/V1__init_schema.sql`

Expected: both table definitions are found.

## Task 4: Add Common Backend Types

**Files:**
- Create: `apps/api/src/main/java/cn/zhaoge/interview/common/ApiResponse.java`
- Create: `apps/api/src/main/java/cn/zhaoge/interview/common/PageResponse.java`
- Create: `apps/api/src/main/java/cn/zhaoge/interview/common/ContentStatus.java`
- Create: `apps/api/src/main/java/cn/zhaoge/interview/common/Difficulty.java`
- Create: `apps/api/src/main/java/cn/zhaoge/interview/common/Frequency.java`
- Create: `apps/api/src/main/java/cn/zhaoge/interview/common/MasteryLevel.java`
- Create: `apps/api/src/main/java/cn/zhaoge/interview/common/GlobalExceptionHandler.java`

- [ ] **Step 1: Create response wrapper**

Create `ApiResponse.java`:

```java
package cn.zhaoge.interview.common;

public record ApiResponse<T>(boolean success, T data, String message) {
    public static <T> ApiResponse<T> ok(T data) {
        return new ApiResponse<>(true, data, "OK");
    }

    public static <T> ApiResponse<T> fail(String message) {
        return new ApiResponse<>(false, null, message);
    }
}
```

- [ ] **Step 2: Create page response**

Create `PageResponse.java`:

```java
package cn.zhaoge.interview.common;

import java.util.List;

public record PageResponse<T>(List<T> records, long total, long page, long size) {
}
```

- [ ] **Step 3: Create enums**

Create `ContentStatus.java`:

```java
package cn.zhaoge.interview.common;

public enum ContentStatus {
    DRAFT,
    PUBLISHED,
    ARCHIVED
}
```

Create `Difficulty.java`:

```java
package cn.zhaoge.interview.common;

public enum Difficulty {
    BASIC,
    INTERMEDIATE,
    ADVANCED,
    EXPERT
}
```

Create `Frequency.java`:

```java
package cn.zhaoge.interview.common;

public enum Frequency {
    LOW,
    MEDIUM,
    HIGH,
    MUST_KNOW
}
```

Create `MasteryLevel.java`:

```java
package cn.zhaoge.interview.common;

public enum MasteryLevel {
    READ,
    EXPLAIN,
    DEEP_EXPLAIN,
    PROJECT_READY
}
```

- [ ] **Step 4: Create exception handler**

Create `GlobalExceptionHandler.java`:

```java
package cn.zhaoge.interview.common;

import org.springframework.http.HttpStatus;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestControllerAdvice;

@RestControllerAdvice
public class GlobalExceptionHandler {
    @ExceptionHandler(IllegalArgumentException.class)
    @ResponseStatus(HttpStatus.BAD_REQUEST)
    public ApiResponse<Void> handleIllegalArgument(IllegalArgumentException ex) {
        return ApiResponse.fail(ex.getMessage());
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    @ResponseStatus(HttpStatus.BAD_REQUEST)
    public ApiResponse<Void> handleValidation(MethodArgumentNotValidException ex) {
        String message = ex.getBindingResult().getFieldErrors().stream()
                .findFirst()
                .map(error -> error.getField() + " " + error.getDefaultMessage())
                .orElse("Invalid request");
        return ApiResponse.fail(message);
    }
}
```

- [ ] **Step 5: Compile**

Run: `cd apps/api && mvn test -DskipTests`

Expected: compile succeeds.

## Task 5: Implement Topic Backend Slice

**Files:**
- Create: `apps/api/src/main/java/cn/zhaoge/interview/topic/Topic.java`
- Create: `apps/api/src/main/java/cn/zhaoge/interview/topic/TopicDto.java`
- Create: `apps/api/src/main/java/cn/zhaoge/interview/topic/TopicUpsertRequest.java`
- Create: `apps/api/src/main/java/cn/zhaoge/interview/topic/mapper/TopicMapper.java`
- Create: `apps/api/src/main/java/cn/zhaoge/interview/topic/TopicService.java`
- Create: `apps/api/src/main/java/cn/zhaoge/interview/topic/PublicTopicController.java`
- Create: `apps/api/src/main/java/cn/zhaoge/interview/topic/AdminTopicController.java`

- [ ] **Step 1: Create entity and DTO**

Create `Topic.java`:

```java
package cn.zhaoge.interview.topic;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import java.time.LocalDateTime;

@TableName("topics")
public class Topic {
    @TableId(type = IdType.AUTO)
    private Long id;
    private String slug;
    private String title;
    private String summary;
    private String targetAudience;
    private String whyImportant;
    private String prerequisites;
    private String knowledgeMap;
    private String interviewFocus;
    private Integer sortOrder;
    private String status;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public String getSlug() { return slug; }
    public void setSlug(String slug) { this.slug = slug; }
    public String getTitle() { return title; }
    public void setTitle(String title) { this.title = title; }
    public String getSummary() { return summary; }
    public void setSummary(String summary) { this.summary = summary; }
    public String getTargetAudience() { return targetAudience; }
    public void setTargetAudience(String targetAudience) { this.targetAudience = targetAudience; }
    public String getWhyImportant() { return whyImportant; }
    public void setWhyImportant(String whyImportant) { this.whyImportant = whyImportant; }
    public String getPrerequisites() { return prerequisites; }
    public void setPrerequisites(String prerequisites) { this.prerequisites = prerequisites; }
    public String getKnowledgeMap() { return knowledgeMap; }
    public void setKnowledgeMap(String knowledgeMap) { this.knowledgeMap = knowledgeMap; }
    public String getInterviewFocus() { return interviewFocus; }
    public void setInterviewFocus(String interviewFocus) { this.interviewFocus = interviewFocus; }
    public Integer getSortOrder() { return sortOrder; }
    public void setSortOrder(Integer sortOrder) { this.sortOrder = sortOrder; }
    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }
    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }
    public LocalDateTime getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(LocalDateTime updatedAt) { this.updatedAt = updatedAt; }
}
```

Create `TopicDto.java`:

```java
package cn.zhaoge.interview.topic;

public record TopicDto(
        Long id,
        String slug,
        String title,
        String summary,
        String targetAudience,
        String whyImportant,
        String prerequisites,
        String knowledgeMap,
        String interviewFocus,
        Integer sortOrder,
        String status
) {
    public static TopicDto from(Topic topic) {
        return new TopicDto(
                topic.getId(),
                topic.getSlug(),
                topic.getTitle(),
                topic.getSummary(),
                topic.getTargetAudience(),
                topic.getWhyImportant(),
                topic.getPrerequisites(),
                topic.getKnowledgeMap(),
                topic.getInterviewFocus(),
                topic.getSortOrder(),
                topic.getStatus()
        );
    }
}
```

- [ ] **Step 2: Create request**

Create `TopicUpsertRequest.java`:

```java
package cn.zhaoge.interview.topic;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

public record TopicUpsertRequest(
        @NotBlank String slug,
        @NotBlank String title,
        @NotBlank String summary,
        @NotBlank String targetAudience,
        @NotBlank String whyImportant,
        @NotBlank String prerequisites,
        @NotBlank String knowledgeMap,
        @NotBlank String interviewFocus,
        @NotNull Integer sortOrder
) {
}
```

- [ ] **Step 3: Create mapper**

Create `mapper/TopicMapper.java`:

```java
package cn.zhaoge.interview.topic.mapper;

import cn.zhaoge.interview.topic.Topic;
import com.baomidou.mybatisplus.core.mapper.BaseMapper;

public interface TopicMapper extends BaseMapper<Topic> {
}
```

- [ ] **Step 4: Create service**

Create `TopicService.java`:

```java
package cn.zhaoge.interview.topic;

import cn.zhaoge.interview.common.ContentStatus;
import cn.zhaoge.interview.topic.mapper.TopicMapper;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import java.util.List;
import org.springframework.stereotype.Service;

@Service
public class TopicService {
    private final TopicMapper topicMapper;

    public TopicService(TopicMapper topicMapper) {
        this.topicMapper = topicMapper;
    }

    public List<TopicDto> listPublished() {
        return topicMapper.selectList(new LambdaQueryWrapper<Topic>()
                .eq(Topic::getStatus, ContentStatus.PUBLISHED.name())
                .orderByAsc(Topic::getSortOrder))
                .stream()
                .map(TopicDto::from)
                .toList();
    }

    public List<TopicDto> listAdmin() {
        return topicMapper.selectList(new LambdaQueryWrapper<Topic>()
                .orderByAsc(Topic::getSortOrder))
                .stream()
                .map(TopicDto::from)
                .toList();
    }

    public TopicDto getPublishedBySlug(String slug) {
        Topic topic = topicMapper.selectOne(new LambdaQueryWrapper<Topic>()
                .eq(Topic::getSlug, slug)
                .eq(Topic::getStatus, ContentStatus.PUBLISHED.name()));
        if (topic == null) {
            throw new IllegalArgumentException("Topic not found");
        }
        return TopicDto.from(topic);
    }

    public TopicDto create(TopicUpsertRequest request) {
        Topic topic = new Topic();
        apply(topic, request);
        topic.setStatus(ContentStatus.DRAFT.name());
        topicMapper.insert(topic);
        return TopicDto.from(topic);
    }

    public TopicDto update(Long id, TopicUpsertRequest request) {
        Topic topic = topicMapper.selectById(id);
        if (topic == null) {
            throw new IllegalArgumentException("Topic not found");
        }
        apply(topic, request);
        topicMapper.updateById(topic);
        return TopicDto.from(topic);
    }

    public TopicDto updateStatus(Long id, ContentStatus status) {
        Topic topic = topicMapper.selectById(id);
        if (topic == null) {
            throw new IllegalArgumentException("Topic not found");
        }
        topic.setStatus(status.name());
        topicMapper.updateById(topic);
        return TopicDto.from(topic);
    }

    private void apply(Topic topic, TopicUpsertRequest request) {
        topic.setSlug(request.slug());
        topic.setTitle(request.title());
        topic.setSummary(request.summary());
        topic.setTargetAudience(request.targetAudience());
        topic.setWhyImportant(request.whyImportant());
        topic.setPrerequisites(request.prerequisites());
        topic.setKnowledgeMap(request.knowledgeMap());
        topic.setInterviewFocus(request.interviewFocus());
        topic.setSortOrder(request.sortOrder());
    }
}
```

- [ ] **Step 5: Create controllers**

Create `PublicTopicController.java`:

```java
package cn.zhaoge.interview.topic;

import cn.zhaoge.interview.common.ApiResponse;
import java.util.List;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/public/topics")
public class PublicTopicController {
    private final TopicService topicService;

    public PublicTopicController(TopicService topicService) {
        this.topicService = topicService;
    }

    @GetMapping
    public ApiResponse<List<TopicDto>> list() {
        return ApiResponse.ok(topicService.listPublished());
    }

    @GetMapping("/{slug}")
    public ApiResponse<TopicDto> detail(@PathVariable String slug) {
        return ApiResponse.ok(topicService.getPublishedBySlug(slug));
    }
}
```

Create `AdminTopicController.java`:

```java
package cn.zhaoge.interview.topic;

import cn.zhaoge.interview.common.ApiResponse;
import cn.zhaoge.interview.common.ContentStatus;
import jakarta.validation.Valid;
import java.util.List;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/admin/topics")
public class AdminTopicController {
    private final TopicService topicService;

    public AdminTopicController(TopicService topicService) {
        this.topicService = topicService;
    }

    @GetMapping
    public ApiResponse<List<TopicDto>> list() {
        return ApiResponse.ok(topicService.listAdmin());
    }

    @PostMapping
    public ApiResponse<TopicDto> create(@Valid @RequestBody TopicUpsertRequest request) {
        return ApiResponse.ok(topicService.create(request));
    }

    @PutMapping("/{id}")
    public ApiResponse<TopicDto> update(@PathVariable Long id, @Valid @RequestBody TopicUpsertRequest request) {
        return ApiResponse.ok(topicService.update(id, request));
    }

    @PatchMapping("/{id}/status")
    public ApiResponse<TopicDto> updateStatus(@PathVariable Long id, @RequestParam ContentStatus status) {
        return ApiResponse.ok(topicService.updateStatus(id, status));
    }
}
```

- [ ] **Step 6: Compile**

Run: `cd apps/api && mvn test -DskipTests`

Expected: compile succeeds.

## Task 6: Implement Question Backend Slice

**Files:**
- Create entities, DTOs, mappers, service, and controllers under `apps/api/src/main/java/cn/zhaoge/interview/question/`

- [ ] **Step 1: Implement minimal question aggregate**

Create these files using the field names from the spec:

- `Question.java`
- `QuestionSection.java`
- `FollowUpQuestion.java`
- `Misconception.java`
- `CorrectionNote.java`
- `ProjectMapping.java`
- `ReferenceSource.java`
- mapper interfaces for each entity.

Each entity maps to its table and includes JavaBean getters/setters.

- [ ] **Step 2: Implement DTOs**

Create:

- `QuestionSummaryDto`
- `QuestionDetailDto`
- `QuestionUpsertRequest`
- `QuestionSectionRequest`
- `FollowUpQuestionRequest`
- `MisconceptionRequest`
- `CorrectionNoteRequest`
- `ProjectMappingRequest`
- `ReferenceSourceRequest`

`QuestionDetailDto` must include the base question and all child content lists.

- [ ] **Step 3: Implement service behavior**

Create `QuestionService` with:

- `listPublished(Long topicId, String keyword, long page, long size)`
- `getPublishedBySlug(String slug)`
- `listAdmin(Long topicId, String status, String keyword, long page, long size)`
- `create(QuestionUpsertRequest request)`
- `update(Long id, QuestionUpsertRequest request)`
- `updateStatus(Long id, ContentStatus status)`

When a question is published, set `publishedAt` if it is null.

- [ ] **Step 4: Implement controllers**

Create:

- `PublicQuestionController` under `/api/public/questions`
- `AdminQuestionController` under `/api/admin/questions`

Public routes:

- `GET /api/public/questions`
- `GET /api/public/questions/{slug}`

Admin routes:

- `GET /api/admin/questions`
- `POST /api/admin/questions`
- `PUT /api/admin/questions/{id}`
- `PATCH /api/admin/questions/{id}/status`

- [ ] **Step 5: Compile**

Run: `cd apps/api && mvn test -DskipTests`

Expected: compile succeeds.

## Task 7: Add Admin Auth

**Files:**
- Create auth classes under `apps/api/src/main/java/cn/zhaoge/interview/auth/`
- Modify: `apps/api/src/main/java/cn/zhaoge/interview/common/GlobalExceptionHandler.java`
- Modify: `apps/api/src/main/resources/db/migration/V1__init_schema.sql`

- [ ] **Step 1: Add default admin seed**

Append to `V1__init_schema.sql`:

```sql
insert into admin_users (username, password_hash, display_name, enabled)
values ('admin', '$2a$10$7QJ8F0VtN8GEW5lh4AcL0u2mGCDMZPpy4TOlHTy9OkoPZUg0puYbW', '管理员', 1);
```

The seeded password is `admin123456`.

- [ ] **Step 2: Implement auth types**

Create:

- `AdminUser.java`
- `AdminUserMapper.java`
- `LoginRequest.java`
- `LoginResponse.java`
- `JwtTokenService.java`
- `AdminAuthController.java`
- `SecurityConfig.java`
- `JwtAuthenticationFilter.java`

Routes:

- `POST /api/admin/auth/login`

Rules:

- Permit `/api/public/**`.
- Permit `/api/admin/auth/login`.
- Require JWT for `/api/admin/**`.

- [ ] **Step 3: Compile**

Run: `cd apps/api && mvn test -DskipTests`

Expected: compile succeeds.

## Task 8: Add Seed Data for Four Topics

**Files:**
- Create: `apps/api/src/main/resources/db/migration/V2__seed_v1_topics.sql`

- [ ] **Step 1: Seed topics**

Create `V2__seed_v1_topics.sql` with four published topics:

```sql
insert into topics (slug, title, summary, target_audience, why_important, prerequisites, knowledge_map, interview_focus, sort_order, status)
values
('java-concurrency', '并发', '围绕锁、线程池、AQS、ThreadLocal 的进阶面试专题。', '3-5 年 Java 后端工程师', '并发是区分 CRUD 熟练工和能处理复杂服务端问题的核心模块。', 'Java 基础、集合、线程基础', '线程模型 -> 内存模型 -> 锁 -> AQS -> 线程池 -> 工具类', '能解释原理，能联系项目线程池和并发风险。', 10, 'PUBLISHED'),
('jvm', 'JVM', '围绕运行时内存、GC、类加载和线上排查的专题。', '3-5 年 Java 后端工程师', 'JVM 体现线上排障和性能分析能力。', 'Java 基础、操作系统内存基础', '内存区域 -> 对象生命周期 -> GC -> 收集器 -> 故障排查 -> 类加载', '能讲清 GC 和排查路径，不停留在术语。', 20, 'PUBLISHED'),
('mysql', 'MySQL', '围绕索引、事务、MVCC、锁和日志的专题。', '3-5 年 Java 后端工程师', 'MySQL 是后端工程师项目深挖里最常见的主战场。', 'SQL 基础、B+ 树基础', '索引 -> 执行计划 -> 事务 -> MVCC -> 锁 -> 日志 -> 调优', '能解释设计原因，能映射慢查询和数据一致性问题。', 30, 'PUBLISHED'),
('redis', 'Redis', '围绕数据结构、持久化、缓存问题和分布式锁的专题。', '3-5 年 Java 后端工程师', 'Redis 高频出现在性能优化、缓存一致性和分布式协调场景。', '缓存基础、网络 IO 基础', '数据结构 -> 持久化 -> 过期淘汰 -> 缓存问题 -> 高可用 -> 分布式锁', '能讲清缓存问题治理和真实项目取舍。', 40, 'PUBLISHED');
```

- [ ] **Step 2: Add one sample question per topic**

Append four questions, each with at least one follow-up, misconception, correction note, project mapping, and reference source.

- [ ] **Step 3: Verify migration files**

Run: `rg -n "java-concurrency|Redis 为什么快|MVCC|AQS" apps/api/src/main/resources/db/migration`

Expected: seed data is present.

## Task 9: Scaffold Next.js Public Site

**Files:**
- Create: `apps/web/package.json`
- Create: `apps/web/next.config.ts`
- Create: `apps/web/tsconfig.json`
- Create: `apps/web/src/app/layout.tsx`
- Create: `apps/web/src/app/page.tsx`
- Create: `apps/web/src/app/topics/page.tsx`
- Create: `apps/web/src/app/topics/[slug]/page.tsx`
- Create: `apps/web/src/app/questions/[slug]/page.tsx`
- Create: `apps/web/src/app/journey/page.tsx`
- Create: `apps/web/src/lib/api.ts`

- [ ] **Step 1: Create package**

Create `apps/web/package.json`:

```json
{
  "name": "interview-platform-web",
  "private": true,
  "scripts": {
    "dev": "next dev -p 3000",
    "build": "next build",
    "lint": "next lint"
  },
  "dependencies": {
    "next": "^15.0.0",
    "react": "^19.0.0",
    "react-dom": "^19.0.0"
  },
  "devDependencies": {
    "@types/node": "^22.0.0",
    "@types/react": "^19.0.0",
    "@types/react-dom": "^19.0.0",
    "typescript": "^5.6.0"
  }
}
```

- [ ] **Step 2: Create API helper**

Create `apps/web/src/lib/api.ts`:

```ts
const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? 'http://localhost:8080';

export async function apiGet<T>(path: string): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, { next: { revalidate: 60 } });
  if (!response.ok) {
    throw new Error(`API request failed: ${response.status}`);
  }
  const body = await response.json();
  if (!body.success) {
    throw new Error(body.message ?? 'API request failed');
  }
  return body.data as T;
}
```

- [ ] **Step 3: Create public pages**

Implement pages that render real API data:

- Home calls `/api/public/topics` and `/api/public/questions?size=8`.
- Topics page calls `/api/public/topics`.
- Topic detail calls `/api/public/topics/{slug}` and `/api/public/questions?topicSlug={slug}`.
- Question detail calls `/api/public/questions/{slug}`.
- Journey calls `/api/public/notes`.

- [ ] **Step 4: Build public app**

Run: `cd apps/web && npm install && npm run build`

Expected: Next.js build succeeds after the backend API types are aligned.

## Task 10: Scaffold Vue Admin Console

**Files:**
- Create: `apps/admin/package.json`
- Create: `apps/admin/vite.config.ts`
- Create: `apps/admin/tsconfig.json`
- Create: `apps/admin/index.html`
- Create: `apps/admin/src/main.ts`
- Create: `apps/admin/src/router/index.ts`
- Create: `apps/admin/src/lib/api.ts`
- Create: `apps/admin/src/stores/auth.ts`
- Create: `apps/admin/src/views/LoginView.vue`
- Create: `apps/admin/src/views/DashboardView.vue`
- Create: `apps/admin/src/views/TopicListView.vue`
- Create: `apps/admin/src/views/QuestionListView.vue`

- [ ] **Step 1: Create package**

Create `apps/admin/package.json`:

```json
{
  "name": "interview-platform-admin",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite --port 5173",
    "build": "vue-tsc -b && vite build"
  },
  "dependencies": {
    "@vitejs/plugin-vue": "^5.1.0",
    "axios": "^1.7.0",
    "pinia": "^2.2.0",
    "vue": "^3.5.0",
    "vue-router": "^4.4.0"
  },
  "devDependencies": {
    "typescript": "^5.6.0",
    "vite": "^5.4.0",
    "vue-tsc": "^2.1.0"
  }
}
```

- [ ] **Step 2: Create admin API helper**

Create `apps/admin/src/lib/api.ts`:

```ts
import axios from 'axios';

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE ?? 'http://localhost:8080',
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('admin_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});
```

- [ ] **Step 3: Create admin routes**

Routes:

- `/login`
- `/dashboard`
- `/topics`
- `/questions`

Login stores `admin_token` in localStorage.

- [ ] **Step 4: Build admin app**

Run: `cd apps/admin && npm install && npm run build`

Expected: Vue app builds.

## Task 11: End-to-End Local Verification

**Files:**
- Modify only if implementation issues require it.

- [ ] **Step 1: Prepare MySQL**

Run:

```bash
mysql -uroot -p123456 -e "create database if not exists interview_platform character set utf8mb4 collate utf8mb4_unicode_ci;"
```

Expected: database exists.

- [ ] **Step 2: Start backend**

Run: `cd apps/api && mvn spring-boot:run`

Expected: backend starts on `http://localhost:8080`.

- [ ] **Step 3: Verify public topics**

Run:

```bash
curl http://localhost:8080/api/public/topics
```

Expected: JSON contains four published topics.

- [ ] **Step 4: Verify admin login**

Run:

```bash
curl -X POST http://localhost:8080/api/admin/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"username":"admin","password":"admin123456"}'
```

Expected: JSON contains a JWT token.

- [ ] **Step 5: Start public site**

Run: `cd apps/web && npm run dev`

Expected: Next.js site starts at `http://localhost:3000`.

- [ ] **Step 6: Start admin console**

Run: `cd apps/admin && npm run dev`

Expected: Vue admin starts at `http://localhost:5173`.

## Self-Review

Spec coverage:

- Product positioning is covered by root README and public site shell.
- MySQL content model is covered by Flyway migrations.
- Backend public/admin API split is covered by Topic and Question controller tasks.
- Admin login is covered by Task 7.
- Public Next.js and Vue admin shells are covered by Tasks 9 and 10.
- V1 topics are covered by seed data in Task 8.

Known scope intentionally left for Phase 2:

- Full CRUD forms for nested question content.
- UI design polish.
- Markdown editor selection and sanitization.
- Deployment scripts.
- Full automated integration test suite.

No placeholder implementation steps are left in Phase 1 for the scaffold, schema, topic slice, auth slice, and frontends. Task 6 intentionally defines the question aggregate as a concentrated implementation unit because the exact Java files repeat the same mapper/entity/DTO pattern from Task 5; implementers should still produce concrete files before moving on.

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-06-16-java-interview-platform-phase-1.md`.

Two execution options:

1. Subagent-Driven (recommended): dispatch a fresh subagent per task, review between tasks, fast iteration.
2. Inline Execution: execute tasks in this session using executing-plans, batch execution with checkpoints.
