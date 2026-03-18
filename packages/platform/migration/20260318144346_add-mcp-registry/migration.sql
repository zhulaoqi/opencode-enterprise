CREATE TABLE "identity_mapping" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"internal_id" uuid DEFAULT gen_random_uuid() NOT NULL UNIQUE,
	"employee_id" varchar(64),
	"feishu_user_id" varchar(128),
	"feishu_union_id" varchar(128),
	"dingtalk_id" varchar(128),
	"wecom_id" varchar(128),
	"name" varchar(256) NOT NULL,
	"email" varchar(256),
	"avatar_url" text,
	"department_ids" jsonb DEFAULT '[]' NOT NULL,
	"job_level" varchar(64),
	"status" varchar(32) DEFAULT 'active' NOT NULL,
	"last_sync_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "mcp_authorization" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"mcp_id" uuid NOT NULL,
	"grantee_type" varchar(16) NOT NULL,
	"grantee_id" varchar(128) NOT NULL,
	"permission" varchar(16) DEFAULT 'use' NOT NULL,
	"granted_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "mcp_group" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"name" varchar(128) NOT NULL,
	"description" text,
	"type" varchar(16) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "mcp_registry" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"name" varchar(128) NOT NULL UNIQUE,
	"display_name" varchar(256) NOT NULL,
	"description" text,
	"type" varchar(16) NOT NULL,
	"config" jsonb NOT NULL,
	"visibility" varchar(16) DEFAULT 'PRIVATE' NOT NULL,
	"owner_id" uuid NOT NULL,
	"group_id" uuid,
	"tags" jsonb DEFAULT '[]',
	"health_status" varchar(16) DEFAULT 'unknown' NOT NULL,
	"last_health_at" timestamp with time zone,
	"enabled" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "department_role" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"department_id" varchar(128) NOT NULL,
	"role_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "role" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"name" varchar(64) NOT NULL UNIQUE,
	"display_name" varchar(128) NOT NULL,
	"description" text,
	"permissions" jsonb DEFAULT '[]' NOT NULL,
	"is_system" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_role" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"user_id" uuid NOT NULL,
	"role_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "enterprise_message" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"session_id" uuid NOT NULL,
	"role" varchar(16) NOT NULL,
	"content" jsonb NOT NULL,
	"tokens_input" integer DEFAULT 0 NOT NULL,
	"tokens_output" integer DEFAULT 0 NOT NULL,
	"tokens_cached" integer DEFAULT 0 NOT NULL,
	"cost_usd" numeric(12,8) DEFAULT '0' NOT NULL,
	"model_id" varchar(128),
	"provider_id" varchar(64),
	"duration_ms" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "enterprise_session" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"user_id" uuid NOT NULL,
	"project_id" varchar(256),
	"title" varchar(512),
	"directory" text,
	"status" varchar(16) DEFAULT 'active' NOT NULL,
	"mcp_snapshot" jsonb,
	"system_prompt" text,
	"metadata" jsonb DEFAULT '{}',
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "enterprise_tool_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"session_id" uuid NOT NULL,
	"message_id" uuid NOT NULL,
	"tool_name" varchar(256) NOT NULL,
	"mcp_name" varchar(128),
	"input" jsonb,
	"output" jsonb,
	"status" varchar(16) NOT NULL,
	"duration_ms" integer,
	"user_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "idx_feishu" ON "identity_mapping" ("feishu_user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_union" ON "identity_mapping" ("feishu_union_id");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_mcp_auth_unique" ON "mcp_authorization" ("mcp_id","grantee_type","grantee_id");--> statement-breakpoint
CREATE INDEX "idx_mcp_visibility" ON "mcp_registry" ("visibility");--> statement-breakpoint
CREATE INDEX "idx_mcp_owner" ON "mcp_registry" ("owner_id");--> statement-breakpoint
CREATE INDEX "idx_message_session" ON "enterprise_message" ("session_id","created_at");--> statement-breakpoint
CREATE INDEX "idx_session_user" ON "enterprise_session" ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "idx_tool_log_session" ON "enterprise_tool_log" ("session_id","created_at");--> statement-breakpoint
CREATE INDEX "idx_tool_log_user" ON "enterprise_tool_log" ("user_id","created_at");--> statement-breakpoint
ALTER TABLE "mcp_authorization" ADD CONSTRAINT "mcp_authorization_mcp_id_mcp_registry_id_fkey" FOREIGN KEY ("mcp_id") REFERENCES "mcp_registry"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "mcp_registry" ADD CONSTRAINT "mcp_registry_owner_id_identity_mapping_internal_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "identity_mapping"("internal_id");--> statement-breakpoint
ALTER TABLE "mcp_registry" ADD CONSTRAINT "mcp_registry_group_id_mcp_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "mcp_group"("id");--> statement-breakpoint
ALTER TABLE "department_role" ADD CONSTRAINT "department_role_role_id_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "role"("id");--> statement-breakpoint
ALTER TABLE "user_role" ADD CONSTRAINT "user_role_user_id_identity_mapping_internal_id_fkey" FOREIGN KEY ("user_id") REFERENCES "identity_mapping"("internal_id");--> statement-breakpoint
ALTER TABLE "user_role" ADD CONSTRAINT "user_role_role_id_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "role"("id");--> statement-breakpoint
ALTER TABLE "enterprise_message" ADD CONSTRAINT "enterprise_message_session_id_enterprise_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "enterprise_session"("id");--> statement-breakpoint
ALTER TABLE "enterprise_session" ADD CONSTRAINT "enterprise_session_user_id_identity_mapping_internal_id_fkey" FOREIGN KEY ("user_id") REFERENCES "identity_mapping"("internal_id");