/**
 * Interchangeable STT provider — never call an STT SDK from components/routes.
 */
export type TranscriptionResult = {
  text: string;
  latencyMs: number;
  model: string;
};

export interface TranscriptionProvider {
  readonly name: string;
  transcribe(audio: Blob | ArrayBuffer, locale?: string): Promise<TranscriptionResult>;
}

export class StubTranscriptionProvider implements TranscriptionProvider {
  readonly name = "stub";

  async transcribe(): Promise<TranscriptionResult> {
    throw new Error("STT not configured — wire a real TranscriptionProvider in Phase 4");
  }
}
