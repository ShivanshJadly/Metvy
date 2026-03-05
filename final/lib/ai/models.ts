export const DEFAULT_CHAT_MODEL: string = "chat-model";

export type ChatModel = {
  id: string;
  name: string;
  description: string;
};

// export const chatModels: ChatModel[] = [
//   {
//     id: "chat-model",
//     name: "Grok Vision",
//     description: "Advanced multimodal model with vision and text capabilities",
//   },
//   {
//     id: "chat-model-reasoning",
//     name: "Grok Reasoning",
//     description:
//       "Uses advanced chain-of-thought reasoning for complex problems",
//   },
// ];

export const chatModels: ChatModel[] = [
  {
    id: "chat-model",
    name: "Gemini 2.5 Flash",
    description: "Advanced multimodal model with vision and text capabilities",
  },
  {
    id: "old-flash",
    name: "Gemini 2.0 Flash",
    description:
      "Last generation model for quick speed and low cost, for less complex tasks",
  },
  {
    id: "new-lite",
    name: "Gemini 2.5 Flash Lite",
    description:
      "Latest model for BLAZING speed and very low cost, for simple tasks",
  },
  {
    id: "chat-model-reasoning",
    name: "Gemini 2.5 Pro",
    description:
      "Uses advanced chain-of-thought reasoning for complex problems",
  },
];
