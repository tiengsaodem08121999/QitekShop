import { apiFetch } from "@/lib/api";

export interface Note {
  content: string | null;
  updated_at: string | null;
}

export function getNote(): Promise<Note> {
  return apiFetch<Note>("/api/note");
}

export function saveNote(content: string): Promise<Note> {
  return apiFetch<Note>("/api/note", {
    method: "PUT",
    body: JSON.stringify({ content }),
  });
}
