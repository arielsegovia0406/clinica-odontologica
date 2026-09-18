import type { TranscriptionProvider, TranscriptionResult } from "./transcription-provider";
import { StubTranscriptionProvider } from "./transcription-provider";
import type { ClinicalExtractor } from "./clinical-extractor";
import { StubClinicalExtractor } from "./clinical-extractor";
import { RuleBasedClinicalExtractor } from "./rule-based-extractor";

/**
 * When the client already produced text (Web Speech / paste), skip STT.
 */
export class PassThroughTranscriptionProvider implements TranscriptionProvider {
  readonly name = "pass-through";

  async transcribe(): Promise<TranscriptionResult> {
    throw new Error(
      "PassThroughTranscriptionProvider requires a transcript from the client",
    );
  }
}

/**
 * Optional OpenAI Whisper-compatible STT when OPENAI_API_KEY / STT_API_KEY is set.
 */
export class OpenAiTranscriptionProvider implements TranscriptionProvider {
  readonly name = "openai-whisper";

  constructor(
    private readonly apiKey: string,
    private readonly baseUrl = "https://api.openai.com/v1",
  ) {}

  async transcribe(
    audio: Blob | ArrayBuffer,
    locale = "es",
  ): Promise<TranscriptionResult> {
    const started = Date.now();
    const blob =
      audio instanceof Blob
        ? audio
        : new Blob([audio], { type: "audio/webm" });
    const form = new FormData();
    form.append("file", blob, "dictado.webm");
    form.append("model", process.env.STT_MODEL ?? "whisper-1");
    form.append("language", locale.slice(0, 2));

    const res = await fetch(`${this.baseUrl}/audio/transcriptions`, {
      method: "POST",
      headers: { Authorization: `Bearer ${this.apiKey}` },
      body: form,
    });
    if (!res.ok) {
      const body = await res.text();
      throw new Error(`STT failed (${res.status}): ${body.slice(0, 200)}`);
    }
    const data = (await res.json()) as { text?: string };
    return {
      text: data.text?.trim() ?? "",
      latencyMs: Date.now() - started,
      model: process.env.STT_MODEL ?? "whisper-1",
    };
  }
}

export function getTranscriptionProvider(): TranscriptionProvider {
  const key = process.env.STT_API_KEY ?? process.env.OPENAI_API_KEY;
  if (key) {
    return new OpenAiTranscriptionProvider(
      key,
      process.env.OPENAI_BASE_URL ?? "https://api.openai.com/v1",
    );
  }
  return new StubTranscriptionProvider();
}

export function getClinicalExtractor(): ClinicalExtractor {
  // LLM path reserved: when LLM_API_KEY set, still prefer rule-based for safety
  // unless LLM_EXTRACTOR=openai (explicit opt-in).
  if (process.env.LLM_EXTRACTOR === "openai") {
    // Keep stub until a vetted clinical prompt is approved; do not invent diagnoses.
    return new StubClinicalExtractor();
  }
  return new RuleBasedClinicalExtractor();
}

export function sttConfigured(): boolean {
  return Boolean(process.env.STT_API_KEY ?? process.env.OPENAI_API_KEY);
}
