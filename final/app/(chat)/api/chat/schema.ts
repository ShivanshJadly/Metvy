import { z } from "zod";

const textPartSchema = z.object({
  type: z.enum(["text"]),
  text: z.string().min(1),
});

const partSchema = textPartSchema;

export const postRequestBodySchema = z.object({
  id: z.string().uuid(),
  message: z.object({
    id: z.string().uuid(),
    role: z.enum(["user"]),
    parts: z.array(partSchema),
  }),
  selectedChatModel: z.enum([
    "chat-model",
    "chat-model-reasoning",
    "old-flash",
    "new-lite",
  ]),
});

export type PostRequestBody = z.infer<typeof postRequestBodySchema>;
