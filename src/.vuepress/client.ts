import { defineClientConfig } from "vuepress/client";
import { h } from "vue";
import DeferredLayoutToggle from "./components/DeferredLayoutToggle.vue";

export default defineClientConfig({
  rootComponents: [() => h(DeferredLayoutToggle)],
});
