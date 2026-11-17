import { knowledgeSidebar } from "./knowledge.js";
import { generatedSidebar, navigationSidebar } from "./navigation.js";
import { privateSidebar } from "./private.js";

const sidebar = {
  ...knowledgeSidebar,
  ...navigationSidebar,
  ...generatedSidebar,
  // 仅本地存在 src/private/ 时才有内容；CI 上为空对象
  ...privateSidebar(),
};

export default sidebar;
