CREATE TABLE "mcp_application" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"mcp_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"status" varchar(16) DEFAULT 'pending' NOT NULL,
	"reason" text,
	"reviewed_by" uuid,
	"reviewed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "mcp_member" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"mcp_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"role" varchar(16) DEFAULT 'user' NOT NULL,
	"granted_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "llm_model" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"name" varchar(64) NOT NULL,
	"model_id" varchar(128) NOT NULL,
	"provider" varchar(32) DEFAULT 'openai' NOT NULL,
	"base_url" varchar(512) NOT NULL,
	"api_key" text NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "idx_mcp_member_unique" ON "mcp_member" ("mcp_id","user_id");--> statement-breakpoint
ALTER TABLE "mcp_application" ADD CONSTRAINT "mcp_application_mcp_id_mcp_registry_id_fkey" FOREIGN KEY ("mcp_id") REFERENCES "mcp_registry"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "mcp_application" ADD CONSTRAINT "mcp_application_user_id_identity_mapping_internal_id_fkey" FOREIGN KEY ("user_id") REFERENCES "identity_mapping"("internal_id");--> statement-breakpoint
ALTER TABLE "mcp_member" ADD CONSTRAINT "mcp_member_mcp_id_mcp_registry_id_fkey" FOREIGN KEY ("mcp_id") REFERENCES "mcp_registry"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "mcp_member" ADD CONSTRAINT "mcp_member_user_id_identity_mapping_internal_id_fkey" FOREIGN KEY ("user_id") REFERENCES "identity_mapping"("internal_id");