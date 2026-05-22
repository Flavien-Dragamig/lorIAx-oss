-- Étendre l'enum notification_type
ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'task_assigned';

-- Nouveaux enums
CREATE TYPE task_kind AS ENUM ('document_item', 'gantt_event');
CREATE TYPE task_status AS ENUM ('open', 'in_progress', 'done', 'cancelled');

-- Table tasks
CREATE TABLE IF NOT EXISTS tasks (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  kind                task_kind        NOT NULL,
  title               VARCHAR(500)     NOT NULL,
  status              task_status      NOT NULL DEFAULT 'open',
  due_at              TIMESTAMPTZ,
  assignee_id         UUID REFERENCES users(id) ON DELETE SET NULL,
  created_by          UUID NOT NULL REFERENCES users(id),
  document_id         UUID REFERENCES documents(id) ON DELETE CASCADE,
  node_id             VARCHAR(100),
  calendar_event_id   UUID REFERENCES calendar_events(id) ON DELETE CASCADE,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE tasks ADD CONSTRAINT chk_tasks_document_item
  CHECK (kind != 'document_item' OR (document_id IS NOT NULL AND node_id IS NOT NULL));

ALTER TABLE tasks ADD CONSTRAINT chk_tasks_gantt_event
  CHECK (kind != 'gantt_event' OR calendar_event_id IS NOT NULL);

CREATE INDEX idx_tasks_assignee_status ON tasks(assignee_id, status);
CREATE INDEX idx_tasks_document ON tasks(document_id);
CREATE INDEX idx_tasks_calendar_event ON tasks(calendar_event_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_tasks_document_node ON tasks(document_id, node_id);
