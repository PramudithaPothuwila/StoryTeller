# Supabase Cloud Projects

StoryTeller v1 stores cloud projects as canonical `StoryProject` JSON in `public.projects.project_json`.
Folder file maps and `.storyteller.json` bundles remain local import/export formats and are not stored in Supabase.

## RLS Verification Notes

After applying `supabase/migrations/20260617000000_cloud_projects.sql`, verify with two signed-in users:

- User A can insert, select, update, and delete rows where `projects.owner_id = auth.uid()`.
- User A cannot select, update, or delete User B project rows.
- User A can select, insert, and update only `user_settings.user_id = auth.uid()`.
- User A can select, insert, and update only `profiles.id = auth.uid()`.

The frontend must use only `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY`. Never place a Supabase secret or service-role key in browser code or Vite environment variables.
