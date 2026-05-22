import TaskItem from "@tiptap/extension-task-item";
import TaskList from "@tiptap/extension-task-list";
import type { CommandProps, RawCommands } from "@tiptap/core";

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    checklist: {
      toggleChecklist: () => ReturnType;
    };
  }
}

// Checklist simple : cases à cocher sans assignation ni suivi BDD.
// Utilise des types de nœuds distincts (checklist / checklistItem) pour ne pas
// déclencher syncDocumentTasks qui cible uniquement "taskItem".

export const ChecklistItem = TaskItem.extend({
  name: "checklistItem",
}).configure({ nested: false });

export const Checklist = TaskList.extend({
  name: "checklist",
  // Override addCommands to avoid conflicting with TaskList's toggleTaskList()
  // which would be overridden since Checklist is registered after TaskList.
  addCommands(): Partial<RawCommands> {
    return {
      toggleChecklist: () => ({ commands }: CommandProps) => {
        return commands.toggleList(this.name, this.options.itemTypeName as string);
      },
    };
  },
}).configure({ itemTypeName: "checklistItem" });
