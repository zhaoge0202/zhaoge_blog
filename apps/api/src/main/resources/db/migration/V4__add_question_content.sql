alter table questions add column content text null after answer_strategy;

update questions
set content = concat(
  '## 30 秒回答\n\n', short_answer,
  '\n\n## 2 分钟回答\n\n', long_answer,
  '\n\n## 深度解释\n\n', deep_dive,
  '\n\n## 回答策略\n\n', answer_strategy
)
where content is null;

alter table questions modify column content text not null;

alter table questions modify column short_answer text null;
alter table questions modify column long_answer text null;
alter table questions modify column deep_dive text null;
alter table questions modify column answer_strategy text null;
