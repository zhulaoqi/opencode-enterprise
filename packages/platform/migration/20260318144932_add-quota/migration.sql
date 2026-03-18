CREATE TABLE "quota_config" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"scope_type" varchar(16) NOT NULL,
	"scope_id" varchar(128) NOT NULL,
	"period" varchar(16) NOT NULL,
	"max_tokens" bigint NOT NULL,
	"max_requests" integer,
	"max_cost_usd" numeric(12,4),
	"enabled" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "quota_usage" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"scope_type" varchar(16) NOT NULL,
	"scope_id" varchar(128) NOT NULL,
	"period_key" varchar(16) NOT NULL,
	"tokens_used" bigint DEFAULT 0 NOT NULL,
	"requests_count" integer DEFAULT 0 NOT NULL,
	"cost_usd" numeric(12,4) DEFAULT '0' NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "idx_quota_config_scope" ON "quota_config" ("scope_type","scope_id","period");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_quota_usage_unique" ON "quota_usage" ("scope_type","scope_id","period_key");