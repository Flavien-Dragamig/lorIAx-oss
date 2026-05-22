CREATE TABLE "document_labels" (
	"document_id" uuid NOT NULL,
	"label_id" uuid NOT NULL,
	CONSTRAINT "document_labels_document_id_label_id_pk" PRIMARY KEY("document_id","label_id")
);
--> statement-breakpoint
CREATE TABLE "labels" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(64) NOT NULL,
	"color" varchar(7) DEFAULT '#6b7280' NOT NULL,
	"space_id" uuid,
	"is_global" boolean DEFAULT false NOT NULL,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "document_labels" ADD CONSTRAINT "document_labels_document_id_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."documents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_labels" ADD CONSTRAINT "document_labels_label_id_labels_id_fk" FOREIGN KEY ("label_id") REFERENCES "public"."labels"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "labels" ADD CONSTRAINT "labels_space_id_spaces_id_fk" FOREIGN KEY ("space_id") REFERENCES "public"."spaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "labels" ADD CONSTRAINT "labels_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_doc_labels_document" ON "document_labels" USING btree ("document_id");--> statement-breakpoint
CREATE INDEX "idx_labels_space" ON "labels" USING btree ("space_id");