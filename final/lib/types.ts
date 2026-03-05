import type { UIMessage } from "ai";
import { z } from "zod";
import type { AppUsage } from "./usage";

export type DataPart = { type: "append-message"; message: string };

export const messageMetadataSchema = z.object({
  createdAt: z.string(),
  resumeIds: z.array(z.string()).nullable().optional(),
});

export type MessageMetadata = z.infer<typeof messageMetadataSchema>;

export type CustomUIDataTypes = {
  textDelta: string;
  imageDelta: string;
  sheetDelta: string;
  codeDelta: string;
  appendMessage: string;
  id: string;
  title: string;
  clear: null;
  finish: null;
  usage: AppUsage;
  "resume-ids": { resumeIds: string[] };
};

export type ChatMessage = UIMessage<MessageMetadata, CustomUIDataTypes>;

export type Attachment = {
  name: string;
  url: string;
  contentType: string;
};

export type SearchResult = {
  embedding_id: string;
  candidate_id: string;
  resume_id: string;
  similarity: number;
  text: string;
  metadata: Record<string, unknown>;
};

export type SearchResponse = {
  results: SearchResult[];
  searchTime: number;
  query: string;
  count: number;
};
