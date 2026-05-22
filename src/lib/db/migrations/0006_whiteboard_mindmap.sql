CREATE TABLE "mindmap_snapshots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"mindmap_id" text NOT NULL,
	"data" text NOT NULL,
	"thumbnail_url" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "mindmap_snapshots_mindmap_id_unique" UNIQUE("mindmap_id")
);
--> statement-breakpoint
CREATE TABLE "whiteboard_snapshots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"canvas_id" text NOT NULL,
	"snapshot" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "whiteboard_snapshots_canvas_id_unique" UNIQUE("canvas_id")
);
