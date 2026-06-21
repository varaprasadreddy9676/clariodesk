-- Snapshot-sync for the hand-written 0004 (which added the enum value via
-- `ADD VALUE IF NOT EXISTS`). drizzle-kit re-emits the enum add because the
-- prior snapshot predates it; this guarded statement is safe whether or not
-- 0004 already added the value, on fresh and existing databases alike.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    WHERE t.typname = 'adapter_type' AND e.enumlabel = 'clario_gateway'
  ) THEN
    ALTER TYPE "adapter_type" ADD VALUE 'clario_gateway' BEFORE 'evolution';
  END IF;
END
$$;
