import * as vscode from "vscode";
import * as path from "path";
import pWaitFor from "p-wait-for";
import { buildApiHandler } from "../../api";
import { openFile, openImage } from "../../integrations/misc/open-file";
import { selectImages } from "../../integrations/misc/process-images";
import { openMention } from "../mentions";
import { Cline } from "../Cline";
import { WebviewManager } from "./WebviewManager";
import { StateManager, GlobalStateKey } from "./state/StateManager";
import { TaskManager } from "./task/TaskManager";
import { ApiManager } from "./api/ApiManager";
import { WebviewMessage } from "../../shared/WebviewMessage";
import { findLast } from "../../shared/array";
import { HistoryItem } from "../../shared/HistoryItem";
import { getTheme } from "../../integrations/theme/getTheme";
import WorkspaceTracker from "../../integrations/workspace/WorkspaceTracker";

export const GlobalFileNames = {
    apiConversationHistory: "api_conversation_history.json",
    uiMessages: "ui_messages.json",
    openRouterModels: "openrouter_models.json",
};

export class ClineProvider implements vscode.WebviewViewProvider {
    public static readonly sideBarId = "cline-rag.SidebarProvider";
    public static readonly tabPanelId = "cline-rag.TabPanelProvider";
    private static activeInstances: Set<ClineProvider> = new Set();
    
    private webviewManager: WebviewManager;
    private stateManager: StateManager;
    private taskManager: TaskManager;
    private apiManager: ApiManager;
    private workspaceTracker?: WorkspaceTracker;
    private cline?: Cline;
    private latestAnnouncementId = "nov-18-2024";

    constructor(
        readonly context: vscode.ExtensionContext,
        private readonly outputChannel: vscode.OutputChannel
    ) {
        this.outputChannel.appendLine("ClineProvider instantiated");
        ClineProvider.activeInstances.add(this);

        this.stateManager = new StateManager(context);
        this.taskManager = new TaskManager(context, this.stateManager);
        this.apiManager = new ApiManager(path.join(context.globalStorageUri.fsPath, "cache"));
        this.webviewManager = new WebviewManager(context, this.handleWebviewMessage.bind(this));
        this.workspaceTracker = new WorkspaceTracker(this);
    }

    public static getVisibleInstance(): ClineProvider | undefined {
        return findLast(Array.from(this.activeInstances), (instance) => instance.webviewManager.visible);
    }

    async dispose() {
        this.outputChannel.appendLine("Disposing ClineProvider...");
        await this.clearTask();
        this.outputChannel.appendLine("Cleared task");
        this.webviewManager.dispose();
        this.workspaceTracker?.dispose();
        this.workspaceTracker = undefined;
        this.outputChannel.appendLine("Disposed all disposables");
        ClineProvider.activeInstances.delete(this);
    }

    resolveWebviewView(webviewView: vscode.WebviewView | vscode.WebviewPanel): void | Thenable<void> {
        this.outputChannel.appendLine("Resolving webview view");
        this.webviewManager.resolveWebviewView(webviewView);
        this.clearTask();
        this.outputChannel.appendLine("Webview view resolved");
    }

    // Public methods needed by other parts of the codebase
    public async postMessageToWebview(message: any) {
        await this.webviewManager.postMessageToWebview(message);
    }

    public async postStateToWebview() {
        const state = await this.getStateToPostToWebview();
        await this.webviewManager.postMessageToWebview({ type: "state", state });
    }

    public async updateTaskHistory(item: HistoryItem): Promise<HistoryItem[]> {
        return await this.taskManager.updateTaskHistory(item);
    }

    public async getTaskWithId(id: string) {
        return await this.taskManager.getTaskWithId(id);
    }

    public async clearTask() {
        this.cline?.abortTask();
        this.cline = undefined;
    }

    public async updateCustomInstructions(instructions?: string) {
        await this.stateManager.updateGlobalState("customInstructions", instructions || undefined);
        if (this.cline) {
            this.cline.customInstructions = instructions || undefined;
        }
        await this.postStateToWebview();
    }

    public async getGlobalState(key: GlobalStateKey) {
        return await this.stateManager.getGlobalState(key);
    }

    public async handleOpenRouterCallback(code: string) {
        const { apiKey } = await this.apiManager.handleOpenRouterCallback(code);
        const openrouter = "openrouter" as const;
        await this.stateManager.updateGlobalState("apiProvider", openrouter);
        await this.stateManager.storeSecret("openRouterApiKey", apiKey);
        await this.postStateToWebview();
        if (this.cline) {
            this.cline.api = buildApiHandler({ apiProvider: openrouter, openRouterApiKey: apiKey });
        }
    }

    public async initClineWithHistoryItem(historyItem: HistoryItem) {
        await this.clearTask();
        const { apiConfiguration, customInstructions, alwaysAllowReadOnly } = await this.stateManager.getState();
        this.cline = new Cline(
            this,
            apiConfiguration,
            customInstructions,
            alwaysAllowReadOnly,
            undefined,
            undefined,
            historyItem
        );
    }

    private async handleWebviewMessage(webview: vscode.Webview, message: WebviewMessage) {
        switch (message.type) {
            case "webviewDidLaunch":
                this.postStateToWebview();
                this.workspaceTracker?.initializeFilePaths();
                const theme = await getTheme();
                this.webviewManager.postMessageToWebview({ type: "theme", text: JSON.stringify(theme) });
                const openRouterModels = await this.apiManager.readOpenRouterModels();
                if (openRouterModels) {
                    this.webviewManager.postMessageToWebview({ type: "openRouterModels", openRouterModels });
                }
                const refreshedModels = await this.apiManager.refreshOpenRouterModels();
                if (refreshedModels) {
                    const { apiConfiguration } = await this.stateManager.getState();
                    if (apiConfiguration.openRouterModelId) {
                        await this.stateManager.updateGlobalState(
                            "openRouterModelInfo",
                            refreshedModels[apiConfiguration.openRouterModelId]
                        );
                        await this.postStateToWebview();
                    }
                }
                break;

            case "newTask":
                await this.initClineWithTask(message.text, message.images);
                break;

            case "apiConfiguration":
                if (message.apiConfiguration) {
                    const {
                        apiProvider,
                        apiModelId,
                        apiKey,
                        openRouterApiKey,
                        awsAccessKey,
                        awsSecretKey,
                        awsSessionToken,
                        awsRegion,
                        awsUseCrossRegionInference,
                        vertexProjectId,
                        vertexRegion,
                        openAiBaseUrl,
                        openAiApiKey,
                        openAiModelId,
                        ollamaModelId,
                        ollamaBaseUrl,
                        lmStudioModelId,
                        lmStudioBaseUrl,
                        anthropicBaseUrl,
                        geminiApiKey,
                        openAiNativeApiKey,
                        azureApiVersion,
                        openRouterModelId,
                        openRouterModelInfo,
                    } = message.apiConfiguration;

                    await this.stateManager.updateGlobalState("apiProvider", apiProvider);
                    await this.stateManager.updateGlobalState("apiModelId", apiModelId);
                    await this.stateManager.storeSecret("apiKey", apiKey);
                    await this.stateManager.storeSecret("openRouterApiKey", openRouterApiKey);
                    await this.stateManager.storeSecret("awsAccessKey", awsAccessKey);
                    await this.stateManager.storeSecret("awsSecretKey", awsSecretKey);
                    await this.stateManager.storeSecret("awsSessionToken", awsSessionToken);
                    await this.stateManager.updateGlobalState("awsRegion", awsRegion);
                    await this.stateManager.updateGlobalState("awsUseCrossRegionInference", awsUseCrossRegionInference);
                    await this.stateManager.updateGlobalState("vertexProjectId", vertexProjectId);
                    await this.stateManager.updateGlobalState("vertexRegion", vertexRegion);
                    await this.stateManager.updateGlobalState("openAiBaseUrl", openAiBaseUrl);
                    await this.stateManager.storeSecret("openAiApiKey", openAiApiKey);
                    await this.stateManager.updateGlobalState("openAiModelId", openAiModelId);
                    await this.stateManager.updateGlobalState("ollamaModelId", ollamaModelId);
                    await this.stateManager.updateGlobalState("ollamaBaseUrl", ollamaBaseUrl);
                    await this.stateManager.updateGlobalState("lmStudioModelId", lmStudioModelId);
                    await this.stateManager.updateGlobalState("lmStudioBaseUrl", lmStudioBaseUrl);
                    await this.stateManager.updateGlobalState("anthropicBaseUrl", anthropicBaseUrl);
                    await this.stateManager.storeSecret("geminiApiKey", geminiApiKey);
                    await this.stateManager.storeSecret("openAiNativeApiKey", openAiNativeApiKey);
                    await this.stateManager.updateGlobalState("azureApiVersion", azureApiVersion);
                    await this.stateManager.updateGlobalState("openRouterModelId", openRouterModelId);
                    await this.stateManager.updateGlobalState("openRouterModelInfo", openRouterModelInfo);

                    if (this.cline) {
                        this.cline.api = buildApiHandler(message.apiConfiguration);
                    }
                }
                await this.postStateToWebview();
                break;

            case "customInstructions":
                await this.updateCustomInstructions(message.text);
                break;

            case "alwaysAllowReadOnly":
                await this.stateManager.updateGlobalState("alwaysAllowReadOnly", message.bool ?? undefined);
                if (this.cline) {
                    this.cline.alwaysAllowReadOnly = message.bool ?? false;
                }
                await this.postStateToWebview();
                break;

            case "askResponse":
                this.cline?.handleWebviewAskResponse(message.askResponse!, message.text, message.images);
                break;

            case "clearTask":
                await this.clearTask();
                await this.postStateToWebview();
                break;

            case "didShowAnnouncement":
                await this.stateManager.updateGlobalState("lastShownAnnouncementId", this.latestAnnouncementId);
                await this.postStateToWebview();
                break;

            case "selectImages":
                const images = await selectImages();
                await this.webviewManager.postMessageToWebview({ type: "selectedImages", images });
                break;

            case "exportCurrentTask":
                if (this.cline?.taskId) {
                    await this.taskManager.exportTaskWithId(this.cline.taskId);
                }
                break;

            case "showTaskWithId":
                await this.showTaskWithId(message.text!);
                break;

            case "deleteTaskWithId":
                await this.taskManager.deleteTaskWithId(message.text!);
                break;

            case "exportTaskWithId":
                await this.taskManager.exportTaskWithId(message.text!);
                break;

            case "resetState":
                await this.resetState();
                break;

            case "requestOllamaModels":
                const ollamaModels = await this.apiManager.getOllamaModels(message.text);
                this.webviewManager.postMessageToWebview({ type: "ollamaModels", ollamaModels });
                break;

            case "requestLmStudioModels":
                const lmStudioModels = await this.apiManager.getLmStudioModels(message.text);
                this.webviewManager.postMessageToWebview({ type: "lmStudioModels", lmStudioModels });
                break;

            case "refreshOpenRouterModels":
                await this.apiManager.refreshOpenRouterModels();
                break;

            case "openImage":
                openImage(message.text!);
                break;

            case "openFile":
                openFile(message.text!);
                break;

            case "openMention":
                openMention(message.text);
                break;

            case "cancelTask":
                if (this.cline) {
                    const { historyItem } = await this.taskManager.getTaskWithId(this.cline.taskId);
                    this.cline.abortTask();
                    await pWaitFor(() => this.cline === undefined || this.cline.didFinishAborting, {
                        timeout: 3_000,
                    }).catch(() => {
                        console.error("Failed to abort task");
                    });
                    if (this.cline) {
                        this.cline.abandoned = true;
                    }
                    await this.initClineWithHistoryItem(historyItem);
                }
                break;
        }
    }

    private async initClineWithTask(task?: string, images?: string[]) {
        await this.clearTask();
        const { apiConfiguration, customInstructions, alwaysAllowReadOnly } = await this.stateManager.getState();
        this.cline = new Cline(this, apiConfiguration, customInstructions, alwaysAllowReadOnly, task, images);
    }

    private async showTaskWithId(id: string) {
        if (id !== this.cline?.taskId) {
            const { historyItem } = await this.taskManager.getTaskWithId(id);
            await this.initClineWithHistoryItem(historyItem);
        }
        await this.webviewManager.postMessageToWebview({ type: "action", action: "chatButtonClicked" });
    }

    private async resetState() {
        vscode.window.showInformationMessage("Resetting state...");
        await this.stateManager.resetState();
        if (this.cline) {
            this.cline.abortTask();
            this.cline = undefined;
        }
        vscode.window.showInformationMessage("State reset");
        await this.postStateToWebview();
        await this.webviewManager.postMessageToWebview({ type: "action", action: "chatButtonClicked" });
    }

    private async getStateToPostToWebview() {
        const state = await this.stateManager.getState();
        return {
            version: this.context.extension?.packageJSON?.version ?? "",
            apiConfiguration: state.apiConfiguration,
            customInstructions: state.customInstructions,
            alwaysAllowReadOnly: state.alwaysAllowReadOnly,
            uriScheme: vscode.env.uriScheme,
            clineMessages: this.cline?.clineMessages || [],
            taskHistory: (state.taskHistory || [])
                .filter((item) => item.ts && item.task)
                .sort((a, b) => b.ts - a.ts),
            shouldShowAnnouncement: state.lastShownAnnouncementId !== this.latestAnnouncementId,
        };
    }
}
