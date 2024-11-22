import * as vscode from 'vscode';
import * as path from 'path';
import { spawn, ChildProcess } from 'child_process';
import { execSync } from 'child_process';

export class RAGManager {
    private flaskProcess: ChildProcess | null = null;
    private outputChannel: vscode.OutputChannel;

    constructor(private context: vscode.ExtensionContext) {
        this.outputChannel = vscode.window.createOutputChannel("RAG Service");
    }

    public async initialize(): Promise<boolean> {
        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (!workspaceFolders) {
            vscode.window.showErrorMessage("No workspace folder is open");
            return false;
        }

        const rootPath = workspaceFolders[0].uri.fsPath;
        const ragPath = path.join(rootPath, '.rag');

        try {
            // Run setup script from the dist directory where it's copied during build
            const setupScriptPath = path.join(this.context.extensionPath, 'dist', 'services', 'rag', 'setup.js');
            this.outputChannel.appendLine(`Running RAG setup script from: ${setupScriptPath}`);
            execSync(`node "${setupScriptPath}"`, { cwd: rootPath });
            this.outputChannel.appendLine("RAG setup completed successfully");

            // Start Flask server
            await this.startFlaskServer(ragPath);
            return true;
        } catch (error) {
            this.outputChannel.appendLine(`Error initializing RAG: ${error}`);
            vscode.window.showErrorMessage("Failed to initialize RAG support");
            return false;
        }
    }

    private async startFlaskServer(ragPath: string): Promise<void> {
        if (this.flaskProcess) {
            this.outputChannel.appendLine("Flask server is already running");
            return;
        }

        const isWindows = process.platform === 'win32';
        const pythonPath = path.join(ragPath, 'venv', isWindows ? 'Scripts' : 'bin', 'python');
        const appPath = path.join(ragPath, 'app.py');

        this.flaskProcess = spawn(pythonPath, [appPath], {
            cwd: ragPath,
            stdio: 'pipe'
        });

        this.flaskProcess.stdout?.on('data', (data) => {
            this.outputChannel.appendLine(`Flask: ${data}`);
        });

        this.flaskProcess.stderr?.on('data', (data) => {
            this.outputChannel.appendLine(`Flask Error: ${data}`);
        });

        this.flaskProcess.on('close', (code) => {
            this.outputChannel.appendLine(`Flask server exited with code ${code}`);
            this.flaskProcess = null;
        });

        // Wait for server to start
        await new Promise<void>((resolve, reject) => {
            let output = '';
            const timeout = setTimeout(() => {
                reject(new Error('Flask server failed to start within timeout'));
            }, 30000);

            const checkOutput = (data: any) => {
                output += data.toString();
                if (output.includes('Running on http://')) {
                    clearTimeout(timeout);
                    resolve();
                }
            };

            this.flaskProcess?.stdout?.on('data', checkOutput);
            this.flaskProcess?.stderr?.on('data', checkOutput);
        });

        this.outputChannel.appendLine("Flask server started successfully");
    }

    public async stopFlaskServer(): Promise<void> {
        if (this.flaskProcess) {
            this.flaskProcess.kill();
            this.flaskProcess = null;
            this.outputChannel.appendLine("Flask server stopped");
        }
    }

    public isServerRunning(): boolean {
        return this.flaskProcess !== null;
    }

    public dispose(): void {
        this.stopFlaskServer();
        this.outputChannel.dispose();
    }
}
