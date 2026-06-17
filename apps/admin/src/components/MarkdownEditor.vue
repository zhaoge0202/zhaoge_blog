<template>
  <section class="markdown-editor">
    <div class="markdown-editor-header">
      <div>
        <p class="field-label">{{ label }}</p>
        <p v-if="hint" class="muted">{{ hint }}</p>
      </div>
      <div class="markdown-toolbar" aria-label="Markdown 工具栏">
        <button type="button" class="secondary compact" @click="insert('## ', '')">H2</button>
        <button type="button" class="secondary compact" @click="insert('### ', '')">H3</button>
        <button type="button" class="secondary compact" @click="wrap('**', '**')">加粗</button>
        <button type="button" class="secondary compact" @click="insert('- ', '')">列表</button>
        <button type="button" class="secondary compact" @click="insert('> ', '')">引用</button>
        <button type="button" class="secondary compact" @click="wrap('`', '`')">代码</button>
        <button type="button" class="secondary compact" @click="wrap('[', '](https://)')">链接</button>
      </div>
    </div>
    <CodeMirror
      ref="editorRef"
      :basic="true"
      class="markdown-code-editor"
      v-model="localValue"
      :lang="lang"
      :placeholder="placeholder"
      @ready="captureView"
    />
  </section>
</template>

<script setup lang="ts">
import { shallowRef } from 'vue';
import { markdown } from '@codemirror/lang-markdown';
import CodeMirror from 'vue-codemirror6';

type EditorReadyPayload = {
  view?: {
    dispatch: (spec: {
      changes: { from: number; insert: string; to: number };
      selection?: { anchor: number; head: number };
      scrollIntoView?: boolean;
    }) => void;
    focus: () => void;
    state: {
      doc: { length: number; toString: () => string };
      selection: { main: { from: number; to: number } };
    };
  };
};

const props = withDefaults(defineProps<{
  label: string;
  placeholder?: string;
  hint?: string;
}>(), {
  hint: '',
  placeholder: '支持 Markdown：## 标题、**加粗**、- 列表、> 引用、`代码`、[链接](https://...)',
});

const editorRef = shallowRef();
const viewRef = shallowRef<EditorReadyPayload['view'] | null>(null);
const localValue = defineModel<string>({ default: '' });
const lang = markdown();

function captureView(payload: EditorReadyPayload) {
  viewRef.value = payload.view ?? null;
}

function updateEditor(insertValue: string, selectionStart: number, selectionEnd: number) {
  const view = viewRef.value;
  if (!view) {
    localValue.value = insertValue;
    return;
  }

  view.dispatch({
    changes: {
      from: 0,
      insert: insertValue,
      to: view.state.doc.length,
    },
    scrollIntoView: true,
    selection: {
      anchor: selectionStart,
      head: selectionEnd,
    },
  });
  view.focus();
}

function insert(prefix: string, suffix: string) {
  const view = viewRef.value;
  const current = localValue.value ?? '';
  const from = view?.state.selection.main.from ?? current.length;
  const to = view?.state.selection.main.to ?? current.length;
  const selected = current.slice(from, to);
  const next = `${current.slice(0, from)}${prefix}${selected}${suffix}${current.slice(to)}`;
  updateEditor(next, from + prefix.length, from + prefix.length + selected.length);
}

function wrap(prefix: string, suffix: string) {
  insert(prefix, suffix);
}
</script>
