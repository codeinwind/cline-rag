import * as vscode from 'vscode';
import * as path from 'path';
import { spawn, ChildProcess } from 'child_process';
import { execSync } from 'child_process';
import { Cline } from '../../core/Cline';

export class RAGManager {
    private flaskProcess: ChildProcess | null = null;
    private outputChannel: vscode.OutputChannel;
    private cline?: Cline;

    constructor(private context: vscode.ExtensionContext) {
        this.outputChannel = vscode.window.createOutputChannel("RAG Service");
    }

    public async initialize(): Promise<boolean> {
        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (!workspaceFolders) {
            vscode.window.showErrorMessage("No workspace folder is not open");
            return false;
        }

        const rootPath = workspaceFolders[0].uri.fsPath;
        const ragPath = path.join(rootPath, '.rag');

        try {
            // Run setup script from the dist directory
            const setupScriptPath = path.join(this.context.extensionPath, 'dist', 'services', 'rag', 'setup.js');
            this.outputChannel.appendLine(`Running RAG setup script from: ${setupScriptPath}`);
            
            // Execute setup script with workspace root path and capture its output
            const setupOutput = execSync(`node "${setupScriptPath}" "${rootPath}"`, { 
                cwd: rootPath,
                encoding: 'utf8',
                stdio: ['inherit', 'pipe', 'pipe'] // Inherit stdin, pipe stdout and stderr
            });
            // Log the setup script's output
            this.outputChannel.appendLine(setupOutput);
            
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
            const message = data.toString();
            // Check if the message contains the development server warning
            if (message.includes('WARNING: This is a development server')) {
                this.outputChannel.appendLine(`Flask Info: ${message}`);
            } else {
                this.outputChannel.appendLine(`Flask: ${message}`);
            }
        });

        this.flaskProcess.stderr?.on('data', (data) => {
            const message = data.toString();
            // Check if this is the development server warning or other expected Flask startup messages
            if (message.includes('WARNING: This is a development server') || 
                message.includes('Running on http://') ||
                message.includes('Press CTRL+C to quit')) {
                this.outputChannel.appendLine(`Flask Info: ${message}`);
            } else {
                // Only mark as error if it's not one of the expected startup messages
                this.outputChannel.appendLine(`Flask Error: ${message}`);
            }
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
