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
