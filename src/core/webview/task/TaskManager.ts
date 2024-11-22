import * as vscode from "vscode";
import * as path from "path";
import * as fs from "fs/promises";
import { Anthropic } from "@anthropic-ai/sdk";
import { HistoryItem } from "../../../shared/HistoryItem";
import { fileExistsAtPath } from "../../../utils/fs";
import { downloadTask } from "../../../integrations/misc/export-markdown";
import { StateManager } from "../state/StateManager";

export const GlobalFileNames = {
    apiConversationHistory: "api_conversation_history.json",
    uiMessages: "ui_messages.json",
    openRouterModels: "openrouter_models.json",
};

export class TaskManager {
    constructor(
        private readonly context: vscode.ExtensionContext,
        private readonly stateManager: StateManager
    ) {}

    async getTaskWithId(id: string): Promise<{
        historyItem: HistoryItem;
        taskDirPath: string;
        apiConversationHistoryFilePath: string;
        uiMessagesFilePath: string;
        apiConversationHistory: Anthropic.MessageParam[];
    }> {
        const history = ((await this.stateManager.getGlobalState("taskHistory")) as HistoryItem[] | undefined) || [];
        const historyItem = history.find((item) => item.id === id);
        if (historyItem) {
            const taskDirPath = path.join(this.context.globalStorageUri.fsPath, "tasks", id);
            const apiConversationHistoryFilePath = path.join(taskDirPath, GlobalFileNames.apiConversationHistory);
            const uiMessagesFilePath = path.join(taskDirPath, GlobalFileNames.uiMessages);
            const fileExists = await fileExistsAtPath(apiConversationHistoryFilePath);
            if (fileExists) {
                const apiConversationHistory = JSON.parse(await fs.readFile(apiConversationHistoryFilePath, "utf8"));
                return {
                    historyItem,
                    taskDirPath,
                    apiConversationHistoryFilePath,
                    uiMessagesFilePath,
                    apiConversationHistory,
                };
            }
        }
        await this.deleteTaskFromState(id);
        throw new Error("Task not found");
    }

    async exportTaskWithId(id: string) {
        const { historyItem, apiConversationHistory } = await this.getTaskWithId(id);
        await downloadTask(historyItem.ts, apiConversationHistory);
    }

    async deleteTaskWithId(id: string) {
        const { taskDirPath, apiConversationHistoryFilePath, uiMessagesFilePath } = await this.getTaskWithId(id);

        await this.deleteTaskFromState(id);

        // Delete the task files
        const apiConversationHistoryFileExists = await fileExistsAtPath(apiConversationHistoryFilePath);
        if (apiConversationHistoryFileExists) {
            await fs.unlink(apiConversationHistoryFilePath);
        }
        const uiMessagesFileExists = await fileExistsAtPath(uiMessagesFilePath);
        if (uiMessagesFileExists) {
            await fs.unlink(uiMessagesFilePath);
        }
        const legacyMessagesFilePath = path.join(taskDirPath, "claude_messages.json");
        if (await fileExistsAtPath(legacyMessagesFilePath)) {
            await fs.unlink(legacyMessagesFilePath);
        }
        await fs.rmdir(taskDirPath); // succeeds if the dir is empty
    }

    async deleteTaskFromState(id: string) {
        const taskHistory = ((await this.stateManager.getGlobalState("taskHistory")) as HistoryItem[] | undefined) || [];
        const updatedTaskHistory = taskHistory.filter((task) => task.id !== id);
        await this.stateManager.updateGlobalState("taskHistory", updatedTaskHistory);
    }

    async updateTaskHistory(item: HistoryItem): Promise<HistoryItem[]> {
        const history = ((await this.stateManager.getGlobalState("taskHistory")) as HistoryItem[]) || [];
        const existingItemIndex = history.findIndex((h) => h.id === item.id);
        if (existingItemIndex !== -1) {
            history[existingItemIndex] = item;
        } else {
            history.push(item);
        }
        await this.stateManager.updateGlobalState("taskHistory", history);
        return history;
    }
}
