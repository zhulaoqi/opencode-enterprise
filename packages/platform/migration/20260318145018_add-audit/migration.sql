CREATE TABLE "audit_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"user_id" uuid NOT NULL,
	"session_id" uuid,
	"action" varchar(64) NOT NULL,
	"model_id" varchar(128),
	"provider_id" varchar(64),
	"tokens_input" integer DEFAULT 0,
	"tokens_output" integer DEFAULT 0,
	"tokens_cached" integer DEFAULT 0,
	"cost_usd" numeric(12,8) DEFAULT '0',
	"tools" jsonb DEFAULT '[]',
	"metadata" jsonb DEFAULT '{}',
	"duration_ms" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "idx_audit_user" ON "audit_log" ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "idx_audit_action" ON "audit_log" ("action","created_at");