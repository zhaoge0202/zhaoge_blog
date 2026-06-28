import { knowledgeSidebar } from "./knowledge.js";
import { generatedSidebar, navigationSidebar } from "./navigation.js";

const sidebar = {
  ...knowledgeSidebar,
  ...navigationSidebar,
  ...generatedSidebar,
};

export default sidebar;
