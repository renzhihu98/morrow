CREATE TABLE "dossiers" (
	"user_id" text PRIMARY KEY NOT NULL,
	"facts" jsonb NOT NULL,
	"patterns" jsonb NOT NULL,
	"size_bytes" integer NOT NULL,
	"rebuilt_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "messages" (
	"id" text NOT NULL,
	"user_id" text NOT NULL,
	"reading_id" text NOT NULL,
	"role" text NOT NULL,
	"parts" jsonb NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	CONSTRAINT "messages_user_id_id_pk" PRIMARY KEY("user_id","id")
);
--> statement-breakpoint
CREATE TABLE "prophecies" (
	"id" text NOT NULL,
	"user_id" text NOT NULL,
	"number" integer NOT NULL,
	"made_in_reading_id" text NOT NULL,
	"fulfilled_in_reading_id" text,
	"statement" text NOT NULL,
	"title" text NOT NULL,
	"check_condition" jsonb NOT NULL,
	"window_start" timestamp with time zone NOT NULL,
	"window_end" timestamp with time zone NOT NULL,
	"likelihood" double precision NOT NULL,
	"watching" text[] NOT NULL,
	"status" text NOT NULL,
	"made_on" text NOT NULL,
	"resolved_at" timestamp with time zone,
	CONSTRAINT "prophecies_user_id_id_pk" PRIMARY KEY("user_id","id"),
	CONSTRAINT "prophecies_user_number" UNIQUE("user_id","number")
);
--> statement-breakpoint
CREATE TABLE "raw_events" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"source_kind" text NOT NULL,
	"occurred_at" timestamp with time zone NOT NULL,
	"payload" jsonb NOT NULL,
	"expires_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "readings" (
	"id" text NOT NULL,
	"user_id" text NOT NULL,
	"local_date" text NOT NULL,
	"timezone" text NOT NULL,
	"status" text NOT NULL,
	"headline" text NOT NULL,
	"prophecy_id" text,
	"summary" text,
	"question_count" integer DEFAULT 0 NOT NULL,
	"opened_at" timestamp with time zone NOT NULL,
	"sealed_at" timestamp with time zone,
	CONSTRAINT "readings_user_id_id_pk" PRIMARY KEY("user_id","id"),
	CONSTRAINT "readings_user_local_date" UNIQUE("user_id","local_date")
);
--> statement-breakpoint
CREATE TABLE "sources" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"kind" text NOT NULL,
	"status" text NOT NULL,
	"access_token_enc" text,
	"refresh_token_enc" text,
	"last_synced_at" timestamp with time zone,
	"stats" jsonb,
	CONSTRAINT "sources_user_kind" UNIQUE("user_id","kind")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"timezone" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "dossiers" ADD CONSTRAINT "dossiers_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "prophecies" ADD CONSTRAINT "prophecies_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "raw_events" ADD CONSTRAINT "raw_events_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "readings" ADD CONSTRAINT "readings_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sources" ADD CONSTRAINT "sources_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "messages_reading" ON "messages" USING btree ("user_id","reading_id","created_at");--> statement-breakpoint
CREATE INDEX "raw_events_expires_at" ON "raw_events" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "raw_events_user_occurred" ON "raw_events" USING btree ("user_id","occurred_at");