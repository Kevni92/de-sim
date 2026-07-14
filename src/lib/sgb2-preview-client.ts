import type { Sgb2ScenarioReference } from "./sgb2-policy";
import type { Sgb2UiPreviewResult } from "./sgb2-ui";

type PreviewResponse =
  | { id: string; ok: true; data: Sgb2UiPreviewResult }
  | { id: string; ok: false; error: string };

class Sgb2PreviewClient {
  private worker = new Worker(new URL("../workers/sgb2-preview.worker.ts", import.meta.url), { type: "module" });
  private pending = new Map<string, { resolve: (value: Sgb2UiPreviewResult) => void; reject: (reason?: unknown) => void }>();
  private tail: Promise<void> = Promise.resolve();

  constructor() {
    this.worker.addEventListener("message", (event: MessageEvent<PreviewResponse>) => {
      const request = this.pending.get(event.data.id);
      if (!request) return;
      this.pending.delete(event.data.id);
      event.data.ok ? request.resolve(event.data.data) : request.reject(new Error(event.data.error));
    });
  }

  preview(runId: string, reference: Sgb2ScenarioReference) {
    const execute = () => {
      const id = crypto.randomUUID();
      return new Promise<Sgb2UiPreviewResult>((resolve, reject) => {
        this.pending.set(id, { resolve, reject });
        this.worker.postMessage({ id, type: "sgb2:preview", payload: { runId, reference } });
      });
    };
    const result = this.tail.then(execute, execute);
    this.tail = result.then(() => undefined, () => undefined);
    return result;
  }
}

export const sgb2PreviewClient = new Sgb2PreviewClient();
