import { createClient, Session, SupabaseClient, User } from "@supabase/supabase-js";
import { migrateProjectShape } from "./story";
import { StoryProject } from "../types";

export type StorageMode = "local" | "cloud";
export type CloudSyncStatus = "signed_out" | "idle" | "saving" | "saved" | "conflict" | "error";

export interface CloudUser {
  id: string;
  email: string | null;
}

export interface CloudProjectSummary {
  id: string;
  title: string;
  schemaVersion: number;
  projectMode: StoryProject["projectMode"];
  version: number;
  createdAt: string;
  updatedAt: string;
}

export interface CloudProjectLoadResult extends CloudProjectSummary {
  project: StoryProject;
}

interface ProjectRow {
  id: string;
  title: string;
  schema_version: number;
  project_mode: StoryProject["projectMode"];
  project_json: unknown;
  version: number;
  created_at: string;
  updated_at: string;
}

export class CloudProjectConflictError extends Error {
  constructor() {
    super("The cloud project changed since you opened it.");
    this.name = "CloudProjectConflictError";
  }
}

let supabaseClient: SupabaseClient | null | undefined;

export function getSupabaseClient(): SupabaseClient | null {
  if (supabaseClient !== undefined) {
    return supabaseClient;
  }

  const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
  const publishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined;

  supabaseClient = url && publishableKey ? createClient(url, publishableKey) : null;
  return supabaseClient;
}

export function cloudUserFromSession(session: Session | null): CloudUser | null {
  return session?.user ? cloudUserFromSupabaseUser(session.user) : null;
}

export async function getCurrentCloudUser(): Promise<CloudUser | null> {
  const client = requireSupabaseClient();
  const { data, error } = await client.auth.getSession();

  if (error) {
    throw new Error(error.message);
  }

  return cloudUserFromSession(data.session);
}

export function subscribeToCloudAuth(onUserChange: (user: CloudUser | null) => void): () => void {
  const client = getSupabaseClient();

  if (!client) {
    onUserChange(null);
    return () => undefined;
  }

  const { data } = client.auth.onAuthStateChange((_event, session) => {
    onUserChange(cloudUserFromSession(session));
  });

  return () => data.subscription.unsubscribe();
}

export async function signInWithPassword(email: string, password: string): Promise<CloudUser> {
  const client = requireSupabaseClient();
  const { data, error } = await client.auth.signInWithPassword({ email, password });

  if (error) {
    throw new Error(error.message);
  }

  if (!data.user) {
    throw new Error("Sign in did not return a user.");
  }

  return cloudUserFromSupabaseUser(data.user);
}

export async function signUpWithPassword(email: string, password: string): Promise<CloudUser> {
  const client = requireSupabaseClient();
  const { data, error } = await client.auth.signUp({ email, password });

  if (error) {
    throw new Error(error.message);
  }

  if (!data.user) {
    throw new Error("Sign up did not return a user.");
  }

  return cloudUserFromSupabaseUser(data.user);
}

export async function sendMagicLink(email: string): Promise<void> {
  const client = requireSupabaseClient();
  const { error } = await client.auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo: typeof window === "undefined" ? undefined : window.location.origin
    }
  });

  if (error) {
    throw new Error(error.message);
  }
}

export async function signOutCloudUser(): Promise<void> {
  const client = requireSupabaseClient();
  const { error } = await client.auth.signOut();

  if (error) {
    throw new Error(error.message);
  }
}

export async function listCloudProjects(): Promise<CloudProjectSummary[]> {
  const client = requireSupabaseClient();
  const { data, error } = await client
    .from("projects")
    .select("id,title,schema_version,project_mode,version,created_at,updated_at")
    .is("deleted_at", null)
    .order("updated_at", { ascending: false });

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []).map(projectSummaryFromRow);
}

export async function openCloudProject(id: string): Promise<CloudProjectLoadResult> {
  const client = requireSupabaseClient();
  const { data, error } = await client
    .from("projects")
    .select("id,title,schema_version,project_mode,project_json,version,created_at,updated_at")
    .eq("id", id)
    .is("deleted_at", null)
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return projectLoadResultFromRow(data as ProjectRow);
}

export async function createCloudProject(project: StoryProject): Promise<CloudProjectLoadResult> {
  const client = requireSupabaseClient();
  const user = await getCurrentCloudUser();

  if (!user) {
    throw new Error("Sign in before saving to cloud.");
  }

  const { data, error } = await client
    .from("projects")
    .insert({
      owner_id: user.id,
      title: project.title,
      schema_version: project.schemaVersion,
      project_mode: project.projectMode,
      project_json: serializeCloudProject(project)
    })
    .select("id,title,schema_version,project_mode,project_json,version,created_at,updated_at")
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return projectLoadResultFromRow(data as ProjectRow);
}

export async function saveCloudProject(
  id: string,
  expectedVersion: number,
  project: StoryProject
): Promise<CloudProjectLoadResult> {
  const client = requireSupabaseClient();
  const nextVersion = expectedVersion + 1;
  const { data, error } = await client
    .from("projects")
    .update({
      title: project.title,
      schema_version: project.schemaVersion,
      project_mode: project.projectMode,
      project_json: serializeCloudProject(project),
      version: nextVersion,
      updated_at: new Date().toISOString()
    })
    .eq("id", id)
    .eq("version", expectedVersion)
    .is("deleted_at", null)
    .select("id,title,schema_version,project_mode,project_json,version,created_at,updated_at")
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  if (!data) {
    throw new CloudProjectConflictError();
  }

  return projectLoadResultFromRow(data as ProjectRow);
}

export async function deleteCloudProject(id: string): Promise<void> {
  const client = requireSupabaseClient();
  const { error } = await client.from("projects").delete().eq("id", id);

  if (error) {
    throw new Error(error.message);
  }
}

export async function readCloudUserSettings(): Promise<unknown | null> {
  const client = requireSupabaseClient();
  const { data, error } = await client.from("user_settings").select("settings").maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return data?.settings ?? null;
}

export async function writeCloudUserSettings(settings: unknown): Promise<void> {
  const client = requireSupabaseClient();
  const user = await getCurrentCloudUser();

  if (!user) {
    return;
  }

  const { error } = await client.from("user_settings").upsert({
    user_id: user.id,
    settings,
    updated_at: new Date().toISOString()
  });

  if (error) {
    throw new Error(error.message);
  }
}

export function serializeCloudProject(project: StoryProject): StoryProject {
  return JSON.parse(JSON.stringify(project)) as StoryProject;
}

function requireSupabaseClient(): SupabaseClient {
  const client = getSupabaseClient();

  if (!client) {
    throw new Error("Supabase is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY.");
  }

  return client;
}

function cloudUserFromSupabaseUser(user: User): CloudUser {
  return {
    id: user.id,
    email: user.email ?? null
  };
}

function projectSummaryFromRow(row: Omit<ProjectRow, "project_json">): CloudProjectSummary {
  return {
    id: row.id,
    title: row.title,
    schemaVersion: row.schema_version,
    projectMode: row.project_mode,
    version: row.version,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function projectLoadResultFromRow(row: ProjectRow): CloudProjectLoadResult {
  return {
    ...projectSummaryFromRow(row),
    project: migrateProjectShape(row.project_json)
  };
}
