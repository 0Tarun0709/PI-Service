# PI-Service TODO & Roadmap

This file tracks proposed enhancements, security updates, and integrations for the Pi Provider Service.

## 📋 Backlog & Enhancements

### 1. 🛡️ Human-in-the-Loop Tool Approvals (Interactive Pre-flight)
*   **Goal**: Prevent destructive agent commands (like writing arbitrary code or running root commands via `bash`) from executing without explicit confirmation.
*   **Implementation Steps**:
    *   [ ] Register a custom Pi agent extension to intercept `tool_call` events.
    *   [ ] If a command/tool is sensitive, pause the execution loop.
    *   [ ] Expose SSE payload `action_required` to notify the client app.
    *   [ ] Expose `POST /api/sessions/:id/approve` endpoint to resume/reject the tool call.

### 2. 🔌 Dynamic Tool Broker (Client-side Tools)
*   **Goal**: Allow calling apps to register their own API tools dynamically upon session creation.
*   **Implementation Steps**:
    *   [ ] Accept a tool definition schema array in the `POST /api/sessions` body.
    *   [ ] Pause the agent run loop when the custom tool is invoked.
    *   [ ] Emit an SSE payload with execution parameters to the client.
    *   [ ] Expose `POST /api/sessions/:id/tool-response` for the client to return execution results.

### 3. 📊 Cost & Token Tracking Analytics
*   **Goal**: Store session execution metadata to calculate token usage and costs.
*   **Implementation Steps**:
    *   [ ] Add `input_tokens`, `output_tokens`, and `cost` columns to the SQLite `sessions` table schema in `src/db/migration.ts`.
    *   [ ] Extract metrics from the Pi session stats payload at the end of each run.
    *   [ ] Expose an analytics route `GET /api/analytics` showing aggregate costs and usage per model.

### 4. 🗂️ Workspace Sandboxing & Path Restrictions
*   **Goal**: Ensure the agent cannot access or write files outside its designated workspace directory.
*   **Implementation Steps**:
    *   [ ] Hook into file tool calls (`read`, `write`, `edit`) to run path resolution checks.
    *   [ ] Validate that all paths resolve inside the session's workspace path.
    *   [ ] Throw errors for any relative or absolute paths escaping the root.
