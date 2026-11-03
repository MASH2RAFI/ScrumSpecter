-- A workspace can pick its own weekend (JS day numbers, 0 = Sunday); null keeps the holiday country's
ALTER TABLE "workspaces" ADD COLUMN "weekend_days" integer[];
