# Private Lessons Aid — Project Memory Brief

## Purpose
This app is a browser-based ESL exercise designer. The workflow is:
1. Import class notes into a queue.
2. Sort notes into bins via keyboard shortcuts.
3. Use LLM templates to generate:
   - **JSON data** from selected bins (e.g., `{ term, definition }`).
   - **HTML skeletons** that consume injected data.
4. Combine skeleton + JSON result to preview and export a standalone exercise HTML.

## Current Architecture
- **Frontend SPA shell**: `index.html`
- **State + pure logic**: `logic.js`
- **UI rendering/events/API calls**: `ui.js`
- **Backend proxy**: `server.py` (`/api/llm`, `/api/models`, static hosting)
- **Deploy target**: Render Python web service (`gunicorn server:app`)

## Data Model (Core)
- `skeletonTemplates[]`: `{id, name, prompt, htmlSkeleton, instructions, createdAt}`
- `dataTemplates[]`: `{id, name, prompt, createdAt}`
- `dataResults[]`: `{id, templateId, templateName, binKeys, items, binsMap, status, responseText, responseJson, error, createdAt}`
- `previewCombo`: selected skeleton + data result IDs for merge/preview
- `llmSettings`: model, token and timeout settings

## Known Good Decisions
- Keep API keys server-side (`OPENAI_API_KEY` env var), never in frontend JS.
- Keep prompt templates editable in UI and persisted in app state.
- Keep "Combine" deterministic: merge selected skeleton with selected successful JSON result.

## Open Product Issue (Priority)
JSON-generation and skeleton-generation prompts are currently operationally separate. Desired update:
- Generate JSON from selected bins.
- Reuse that JSON (or schema/example extracted from it) when prompting for skeleton generation.
- Ensure skeleton output includes reliable insertion point (`<!--DATA-->`).
- Always show the **full final prompt** sent to the LLM.

## Prompt System Direction (Recommended)
Move to explicit prompt composition with visible sections:
- **System/Contract section** (format + constraints)
- **Task section** (what to generate)
- **Data section** (selected bins, optional sample JSON)
- **Output section** (strict response requirements)

Store these sections separately, then compile into one final prompt string before request.

## Context / Memory Management Practices (for future sessions)
Because the owner is new to advanced LLM patterns, default to these:

1. **Session Brief First**
   - Start each coding session by loading this file plus key files (`index.html`, `logic.js`, `ui.js`, `server.py`).

2. **Prompt Versioning**
   - Save prompt templates with small version notes (`v1`, `v2`) and intent.
   - Avoid overwriting old prompts without trace.

3. **Deterministic Artifacts**
   - Keep generated JSON results immutable once saved; create new result entries for reruns.

4. **Explicit Contract Checks**
   - Validate generated JSON against expected structure before marking success.
   - Validate skeleton contains `<!--DATA-->` before enabling combine.

5. **Debug Visibility**
   - For every LLM call, persist: final compiled prompt, model, settings, raw response, parsed result status.

6. **Small-Surface Changes**
   - Prefer adding fields to existing state model over broad refactors.

## Deployment Notes (Render)
- Build command: `pip install -r requirements.txt`
- Start command: `gunicorn server:app`
- App must bind `0.0.0.0` and use `PORT` env var.
- `OPENAI_API_KEY` must be set in Render environment.

## Next Milestone
Implement “Linked Prompt Pipeline”:
1. User selects bins.
2. Run JSON template => saved result.
3. Build skeleton prompt with optional `exampleJson` block from chosen JSON result.
4. Generate skeleton.
5. Combine skeleton + selected JSON result into preview HTML with `window.STUDENT_DATA` injection.

