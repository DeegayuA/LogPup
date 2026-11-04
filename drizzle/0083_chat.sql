-- Module D: Team Communication — channels, DMs, threads, reactions, presence.
--
-- channels: one table for every conversation shape, told apart by `kind`:
--   public  — a project channel anyone on the project can read and join
--   private — a project channel only its members can see
--   group   — an ad-hoc group chat between named people (no project)
--   dm      — exactly two people; dm_key ("<smaller uuid>:<larger uuid>") is
--             unique so a pair can never end up with two DM channels
--   context — the conversation attached to ONE work item (task, doc, bug);
--             (context_type, context_id) is unique, so "Discuss" always
--             opens the same thread for that item
-- channel_members: who is in a conversation, and how far they have read
-- (last_read_at drives unread counts). Public channels still get a member
-- row on first post/join, so unread counts work there too.
-- messages: soft-deleted ("This message was deleted" keeps a thread's shape);
-- parent_id makes a reply part of a thread under its root message.
-- message_reactions: one row per person per emoji per message.
-- user_presence: presence ("Busy", "In a meeting"…) with an optional expiry;
-- an expired status reads as no status, so nothing has to sweep it.
CREATE TABLE IF NOT EXISTS "channels" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "kind" text NOT NULL,
  "app_id" uuid REFERENCES "apps"("id") ON DELETE CASCADE,
  "name" text,
  "topic" text,
  "dm_key" text,
  "context_type" text,
  "context_id" uuid,
  "created_by" uuid NOT NULL REFERENCES "users"("id"),
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "archived_at" timestamp with time zone,
  CONSTRAINT "channels_kind" CHECK (kind = ANY (ARRAY['public'::text, 'private'::text, 'group'::text, 'dm'::text, 'context'::text])),
  CONSTRAINT "channels_project_kinds_have_app" CHECK ((kind <> ALL (ARRAY['public'::text, 'private'::text, 'context'::text])) OR (app_id IS NOT NULL)),
  CONSTRAINT "channels_dm_has_key" CHECK ((kind <> 'dm'::text) OR (dm_key IS NOT NULL)),
  CONSTRAINT "channels_context_shape" CHECK ((kind <> 'context'::text) OR ((context_type = ANY (ARRAY['task'::text, 'doc'::text, 'bug'::text])) AND (context_id IS NOT NULL)))
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "channels_dm_key_idx" ON "channels" ("dm_key") WHERE "dm_key" IS NOT NULL;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "channels_context_idx" ON "channels" ("context_type", "context_id") WHERE "context_type" IS NOT NULL;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "channels_app_name_idx" ON "channels" ("app_id", lower("name")) WHERE "kind" = ANY (ARRAY['public'::text, 'private'::text]);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "channels_app_idx" ON "channels" ("app_id") WHERE "app_id" IS NOT NULL;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "channel_members" (
  "channel_id" uuid NOT NULL REFERENCES "channels"("id") ON DELETE CASCADE,
  "user_id" uuid NOT NULL REFERENCES "users"("id"),
  "role" text DEFAULT 'member' NOT NULL,
  "joined_at" timestamp with time zone DEFAULT now() NOT NULL,
  "last_read_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "channel_members_pk" PRIMARY KEY ("channel_id", "user_id"),
  CONSTRAINT "channel_members_role" CHECK (role = ANY (ARRAY['owner'::text, 'member'::text]))
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "channel_members_user_idx" ON "channel_members" ("user_id");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "messages" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "channel_id" uuid NOT NULL REFERENCES "channels"("id") ON DELETE CASCADE,
  "author_id" uuid NOT NULL REFERENCES "users"("id"),
  "parent_id" uuid REFERENCES "messages"("id") ON DELETE CASCADE,
  "body" text NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "edited_at" timestamp with time zone,
  "deleted_at" timestamp with time zone,
  "deleted_by" uuid REFERENCES "users"("id")
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "messages_channel_idx" ON "messages" ("channel_id", "created_at") WHERE "parent_id" IS NULL;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "messages_thread_idx" ON "messages" ("parent_id", "created_at") WHERE "parent_id" IS NOT NULL;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "message_reactions" (
  "message_id" uuid NOT NULL REFERENCES "messages"("id") ON DELETE CASCADE,
  "user_id" uuid NOT NULL REFERENCES "users"("id"),
  "emoji" text NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "message_reactions_pk" PRIMARY KEY ("message_id", "user_id", "emoji")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "user_presence" (
  "user_id" uuid PRIMARY KEY NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "status" text NOT NULL,
  "note" text,
  "expires_at" timestamp with time zone,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "user_presence_kind" CHECK (status = ANY (ARRAY['available'::text, 'busy'::text, 'meeting'::text, 'focus'::text, 'lunch'::text, 'away'::text, 'dnd'::text]))
);
