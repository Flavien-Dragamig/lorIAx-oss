CREATE TABLE "user_whiteboard_library" (
  "user_id" uuid PRIMARY KEY NOT NULL,
  "library_items" jsonb NOT NULL DEFAULT '[]',
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "user_whiteboard_library_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE
);
