"use server";

import type { AppUsage } from "@/lib/usage";
// biome-ignore lint/performance/noNamespaceImport: ignore this
import * as queries from "./queries";
import type { NewDBMessage, User } from "./schema";

export async function getUser(email: string): Promise<User[]> {
  return await queries.getUser(email);
}

export async function createUser(
  email: string,
  password: string,
  name: string
) {
  return await queries.createUser(email, password, name);
}

export async function saveChat(params: {
  id?: string;
  userId: string;
  title: string;
}) {
  return await queries.saveChat(params);
}

export async function deleteChatById(params: { id: string }) {
  return await queries.deleteChatById(params);
}

export async function getChatsByUserId(params: {
  userId: string;
  limit: number;
  startingAfter: string | null;
  endingBefore: string | null;
}) {
  return await queries.getChatsByUserId(params);
}

export async function getChatById(params: { id: string }) {
  return await queries.getChatById(params);
}

export async function updateChatLastContextById(params: {
  chatId: string;
  context: AppUsage;
}) {
  return await queries.updateChatLastContextById(params);
}

export async function saveMessages(params: { messages: NewDBMessage[] }) {
  return await queries.saveMessages(params);
}

export async function getMessagesByChatId(params: { id: string }) {
  return await queries.getMessagesByChatId(params);
}

export async function getMessageById(params: { id: string }) {
  return await queries.getMessageById(params);
}

export async function deleteMessagesByChatIdAfterTimestamp(params: {
  chatId: string;
  timestamp: Date;
}) {
  return await queries.deleteMessagesByChatIdAfterTimestamp(params);
}

export async function getMessageCountByUserId(params: {
  id: string;
  differenceInHours: number;
}) {
  return await queries.getMessageCountByUserId(params);
}

export async function createResumeRequest(params: {
  userId: string;
  chatId: string;
  resumeIds: string[];
  candidateIds: string[];
  requestMessage?: string;
}) {
  return await queries.createResumeRequest(params);
}

export async function getResumeRequestsByUserId(userId: string) {
  return await queries.getResumeRequestsByUserId(userId);
}

export async function getAllResumeRequests({
  limit,
  offset,
}: {
  limit: number;
  offset: number;
}) {
  return await queries.getAllResumeRequests({
    limit,
    offset,
  });
}

export async function updateResumeRequestStatus(params: {
  id: string;
  status: "pending" | "approved" | "rejected";
  notes?: string;
}) {
  return await queries.updateResumeRequestStatus(params);
}

export async function getCandidatesByIds(candidateIds: string[]) {
  return await queries.getCandidatesByIds(candidateIds);
}

export async function getResumesByIds(resumeIds: string[]) {
  return await queries.getResumesByIds(resumeIds);
}

export async function getResumeRequestsCount() {
  return await queries.getResumeRequestsCount();
}
