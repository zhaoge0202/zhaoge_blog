alter table topics add column content text null after summary;

update topics
set content = concat(
  '## 为什么重要\n\n', why_important,
  '\n\n## 知识主线\n\n', knowledge_map,
  '\n\n## 面试焦点\n\n', interview_focus,
  '\n\n## 前置知识\n\n', prerequisites,
  '\n\n## 目标人群\n\n', target_audience
)
where content is null;

alter table topics modify column content text not null;
