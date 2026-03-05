// import { gateway } from "@ai-sdk/gateway";
import { google } from "@ai-sdk/google";
import {
  customProvider,
  extractReasoningMiddleware,
  wrapLanguageModel,
} from "ai";
import { isTestEnvironment } from "../constants";

export const myProvider = isTestEnvironment
  ? (() => {
      const {
        chatModel,
        reasoningModel,
        newLite,
        oldFlash,
        titleModel,
      } = require("./models.mock");
      return customProvider({
        languageModels: {
          "chat-model": chatModel,
          "chat-model-reasoning": reasoningModel,
          "old-flash": oldFlash,
          "new-lite": newLite,
          "title-model": titleModel,
        },
      });
    })()
  : customProvider({
      languageModels: {
        "chat-model": wrapLanguageModel({
          model: google("gemini-2.5-flash"),
          middleware: extractReasoningMiddleware({
            tagName: "think",
          }),
        }),
        "new-lite": google("gemini-2.5-flash-lite"),
        "old-flash": google("gemini-2.0-flash"),
        "chat-model-reasoning": wrapLanguageModel({
          model: google("gemini-2.5-pro"),
          middleware: extractReasoningMiddleware({ tagName: "think" }),
        }),
        "title-model": google("gemini-2.5-flash-lite"),
        // "chat-model": gateway.languageModel("xai/grok-2-vision-1212"),
        // "chat-model-reasoning": wrapLanguageModel({
        //   model: gateway.languageModel("xai/grok-3-mini"),
        //   middleware: extractReasoningMiddleware({ tagName: "think" }),
        // }),
        // "title-model": gateway.languageModel("xai/grok-2-1212"),
        // "artifact-model": gateway.languageModel("xai/grok-2-1212"),
      },
    });
