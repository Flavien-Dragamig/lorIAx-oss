CREATE TABLE "spreadsheet_data" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"sheet_id" text NOT NULL,
	"space_id" uuid,
	"data" text DEFAULT '[]' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "spreadsheet_data_sheet_id_unique" UNIQUE("sheet_id")
);
--> statement-breakpoint
ALTER TABLE "documents" ADD COLUMN "properties" jsonb;--> statement-breakpoint
ALTER TABLE "spreadsheet_data" ADD CONSTRAINT "spreadsheet_data_space_id_spaces_id_fk" FOREIGN KEY ("space_id") REFERENCES "public"."spaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_spreadsheet_data_sheet_id" ON "spreadsheet_data" USING btree ("sheet_id");--> statement-breakpoint
CREATE INDEX "idx_spreadsheet_data_space_id" ON "spreadsheet_data" USING btree ("space_id");