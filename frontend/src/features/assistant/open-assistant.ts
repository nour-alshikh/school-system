/**
 * Opens the assistant from anywhere (the setup checklist, a help link…),
 * optionally asking a question straight away. The panel in the top bar
 * listens for it; nothing happens when the assistant isn't available.
 */
export const OPEN_ASSISTANT_EVENT = "assistant:open";

export interface OpenAssistantDetail {
  question?: string;
}

export function openAssistant(question?: string) {
  window.dispatchEvent(new CustomEvent<OpenAssistantDetail>(OPEN_ASSISTANT_EVENT, { detail: { question } }));
}
