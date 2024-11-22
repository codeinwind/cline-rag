import { VSCodeButton, VSCodeLink } from "@vscode/webview-ui-toolkit/react"
import { memo } from "react"

interface AnnouncementProps {
	version: string
	hideAnnouncement: () => void
}
/*
You must update the latestAnnouncementId in ClineProvider for new announcements to show to users. This new id will be compared with whats in state for the 'last announcement shown', and if it's different then the announcement will render. As soon as an announcement is shown, the id will be updated in state. This ensures that announcements are not shown more than once, even if the user doesn't close it themselves.
*/
const Announcement = ({ version, hideAnnouncement }: AnnouncementProps) => {
	const minorVersion = version.split(".").slice(0, 2).join(".") // 2.0.0 -> 2.0
	return (
		<div
			style={{
				backgroundColor: "var(--vscode-editor-inactiveSelectionBackground)",
				borderRadius: "3px",
				padding: "12px 16px",
				margin: "5px 15px 5px 15px",
				position: "relative",
				flexShrink: 0,
			}}>
			<VSCodeButton
				appearance="icon"
				onClick={hideAnnouncement}
				style={{ position: "absolute", top: "8px", right: "8px" }}>
				<span className="codicon codicon-close"></span>
			</VSCodeButton>
			<h3 style={{ margin: "0 0 8px" }}>
				🎉{"  "}New in v{minorVersion}
			</h3>
			<p style={{ margin: "5px 0px" }}>
				Cline now uses Anthropic's new{" "}
				<VSCodeLink
					href="https://www.anthropic.com/news/3-5-models-and-computer-use"
					style={{ display: "inline" }}>
					"Computer Use"
				</VSCodeLink>{" "}
				feature to launch a browser, click, type, and scroll. This gives him more autonomy in runtime debugging,
				end-to-end testing, and even general web use. Try asking "Look up the weather in Colorado" to see it in
				action, or{" "}
				<VSCodeLink href="https://x.com/sdrzn/status/1850880547825823989" style={{ display: "inline" }}>
					see a full demo here.
				</VSCodeLink>
			</p>
			<p style={{ margin: "5px 0px" }}>
				📚 Introducing Local RAG Support! Enhance your conversations with context from your own knowledge base. 
				Press <code>Cmd+Shift+P</code> (<code>Ctrl+Shift+P</code> on Windows/Linux) and run "Initialize RAG" to set up your 
				documentation, codebase, or any text files as a knowledge source.
			</p>
			<p style={{ margin: "5px 0px" }}>
				Built with a robust architecture:
				<ul style={{ margin: "8px 0 8px 20px", paddingLeft: "0" }}>
					<li><strong>Embedding Engine:</strong> Uses all-MiniLM-L6-v2 model to convert text into high-quality vector representations</li>
					<li><strong>Vector Store:</strong> FAISS-powered similarity search for efficient context retrieval</li>
					<li><strong>API Layer:</strong> FastAPI server enabling seamless integration with VSCode</li>
					<li><strong>TypeScript Interface:</strong> Robust RAG operations management in the VSCode environment</li>
				</ul>
				Perfect for:
				<ul style={{ margin: "8px 0 8px 20px", paddingLeft: "0" }}>
					<li>Project-specific queries and documentation assistance</li>
					<li>Codebase understanding and technical discussions</li>
					<li>Custom knowledge base integration</li>
				</ul>
				Try asking questions about your files after initialization!
			</p>
			<p style={{ margin: "0" }}>
				Join{" "}
				<VSCodeLink style={{ display: "inline" }} href="https://discord.gg/cline">
					discord.gg/cline
				</VSCodeLink>
				{" "}for more updates!
			</p>
		</div>
	)
}

export default memo(Announcement)
