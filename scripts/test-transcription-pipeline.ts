#!/usr/bin/env tsx
/**
 * Test du pipeline de transcription complet.
 * Vérifie chaque étape : services → enregistrement → transcription → résumé.
 *
 * Usage : npx tsx scripts/test-transcription-pipeline.ts
 */

import { resolve } from "path";
import { readdir, stat, writeFile } from "fs/promises";
import { existsSync } from "fs";

const WHISPER_URL = process.env.WHISPER_API_URL || "http://localhost:9000";
const VOXTRAL_URL = process.env.VOXTRAL_API_URL || "http://localhost:9001";
const OLLAMA_URL = process.env.OLLAMA_BASE_URL || "http://localhost:11434";
const LIVEKIT_URL = (process.env.LIVEKIT_URL || "ws://localhost:7880").replace(/^wss?:\/\//, "http://");
const EGRESS_PATH = resolve(process.env.LIVEKIT_EGRESS_PATH || "./data/recordings");

type Status = "ok" | "fail" | "warn" | "skip";

function log(step: string, status: Status, detail: string) {
  const icons: Record<Status, string> = { ok: "✅", fail: "❌", warn: "⚠️", skip: "⏭️" };
  console.log(`${icons[status]}  ${step.padEnd(30)} ${detail}`);
}

async function checkService(name: string, url: string, path: string = ""): Promise<boolean> {
  try {
    const res = await fetch(`${url}${path}`, { signal: AbortSignal.timeout(5000) });
    if (res.ok) {
      log(name, "ok", `${url}${path} → ${res.status}`);
      return true;
    }
    log(name, "fail", `${url}${path} → ${res.status}`);
    return false;
  } catch (err) {
    log(name, "fail", `${url}${path} → connexion refusée`);
    return false;
  }
}

async function checkRecordingDir(): Promise<string[]> {
  if (!existsSync(EGRESS_PATH)) {
    log("Répertoire enregistrements", "fail", `${EGRESS_PATH} n'existe pas`);
    return [];
  }

  const files = await readdir(EGRESS_PATH);
  const audioFiles = files.filter((f) =>
    [".ogg", ".mp3", ".wav", ".webm"].some((ext) => f.endsWith(ext))
  );

  if (audioFiles.length === 0) {
    log("Répertoire enregistrements", "warn", `${EGRESS_PATH} existe mais aucun fichier audio`);
  } else {
    log("Répertoire enregistrements", "ok", `${audioFiles.length} fichier(s) audio trouvé(s)`);
  }

  return audioFiles.map((f) => resolve(EGRESS_PATH, f));
}

async function testWhisperTranscription(filePath: string): Promise<string | null> {
  try {
    const { readFile } = await import("fs/promises");
    const { basename } = await import("path");

    const fileBuffer = await readFile(filePath);
    const fileName = basename(filePath);

    const formData = new FormData();
    formData.append(
      "audio_file",
      new Blob([fileBuffer], { type: "audio/ogg" }),
      fileName
    );

    const url = `${WHISPER_URL}/asr?language=fr&output=json&word_timestamps=true`;
    log("Whisper transcription", "ok", `Envoi de ${fileName} (${(fileBuffer.length / 1024).toFixed(0)} Ko)...`);

    const start = Date.now();
    const res = await fetch(url, {
      method: "POST",
      body: formData,
      signal: AbortSignal.timeout(300_000),
    });

    if (!res.ok) {
      const errorText = await res.text().catch(() => "?");
      log("Whisper transcription", "fail", `HTTP ${res.status}: ${errorText.slice(0, 200)}`);
      return null;
    }

    const data = await res.json();
    const elapsed = ((Date.now() - start) / 1000).toFixed(1);
    const text = (data.text || "").trim();
    const segments = data.segments?.length || 0;

    log("Whisper transcription", "ok", `${elapsed}s — ${segments} segments — "${text.slice(0, 80)}..."`);
    return text;
  } catch (err) {
    log("Whisper transcription", "fail", String(err));
    return null;
  }
}

async function testVoxtralTranscription(filePath: string): Promise<string | null> {
  try {
    const { readFile } = await import("fs/promises");
    const { basename } = await import("path");

    const fileBuffer = await readFile(filePath);
    const fileName = basename(filePath);

    const formData = new FormData();
    formData.append(
      "audio_file",
      new Blob([fileBuffer], { type: "audio/ogg" }),
      fileName
    );

    const url = `${VOXTRAL_URL}/asr?language=fr&output=json&word_timestamps=true`;
    log("Voxtral transcription", "ok", `Envoi de ${fileName}...`);

    const start = Date.now();
    const res = await fetch(url, {
      method: "POST",
      body: formData,
      signal: AbortSignal.timeout(600_000),
    });

    if (!res.ok) {
      const errorText = await res.text().catch(() => "?");
      log("Voxtral transcription", "fail", `HTTP ${res.status}: ${errorText.slice(0, 200)}`);
      return null;
    }

    const data = await res.json();
    const elapsed = ((Date.now() - start) / 1000).toFixed(1);
    const text = (data.text || "").trim();

    log("Voxtral transcription", "ok", `${elapsed}s — "${text.slice(0, 80)}..."`);
    return text;
  } catch (err) {
    log("Voxtral transcription", "fail", String(err));
    return null;
  }
}

async function testOllamaSummary(transcript: string): Promise<boolean> {
  try {
    const res = await fetch(`${OLLAMA_URL}/api/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: process.env.DEFAULT_AI_MODEL || "gemma4:e4b",
        prompt: `Résume cette transcription en 2 phrases :\n\n${transcript.slice(0, 1000)}`,
        stream: false,
      }),
      signal: AbortSignal.timeout(60_000),
    });

    if (!res.ok) {
      log("Ollama résumé", "fail", `HTTP ${res.status}`);
      return false;
    }

    const data = await res.json();
    const summary = (data.response || "").trim();
    log("Ollama résumé", "ok", `"${summary.slice(0, 120)}..."`);
    return true;
  } catch (err) {
    log("Ollama résumé", "fail", String(err));
    return false;
  }
}

// ---- Main ----

async function main() {
  console.log("\n🔍 Test du pipeline de transcription LorIAx\n");
  console.log("=".repeat(60));

  // 1. Services
  console.log("\n📡 Étape 1 — Vérification des services\n");
  const livekitUp = await checkService("LiveKit", LIVEKIT_URL);
  const whisperUp = await checkService("Whisper", WHISPER_URL, "/docs")
    || await checkService("Whisper (fallback /)", WHISPER_URL);
  const voxtralUp = await checkService("Voxtral", VOXTRAL_URL, "/health");
  const ollamaUp = await checkService("Ollama", OLLAMA_URL, "/api/tags");

  if (!whisperUp && !voxtralUp) {
    log("RÉSULTAT", "fail", "Aucun moteur de transcription disponible — impossible de transcrire");
    process.exit(1);
  }

  // 2. Enregistrements
  console.log("\n📁 Étape 2 — Répertoire d'enregistrements\n");
  const audioFiles = await checkRecordingDir();

  // 3. Transcription
  console.log("\n🎤 Étape 3 — Test de transcription\n");

  const testFile = audioFiles[0];
  let transcript: string | null = null;

  if (!testFile) {
    log("Transcription", "skip", "Aucun fichier audio pour tester — les services sont prêts");
  } else {
    // Test Voxtral first (configured engine)
    if (voxtralUp) {
      transcript = await testVoxtralTranscription(testFile);
    }
    // Fallback to Whisper
    if (!transcript && whisperUp) {
      transcript = await testWhisperTranscription(testFile);
    }
  }

  // 4. Résumé
  console.log("\n🤖 Étape 4 — Test de résumé IA\n");

  if (!ollamaUp) {
    log("Ollama résumé", "skip", "Ollama indisponible");
  } else if (!transcript) {
    log("Ollama résumé", "skip", "Pas de transcription à résumer");
  } else {
    await testOllamaSummary(transcript);
  }

  // Bilan
  console.log("\n" + "=".repeat(60));
  console.log("\n📊 Bilan\n");
  log("LiveKit (visio)", livekitUp ? "ok" : "fail", livekitUp ? "prêt" : "arrêté");
  log("Whisper (STT)", whisperUp ? "ok" : "fail", whisperUp ? "prêt" : "arrêté");
  log("Voxtral (STT Mistral)", voxtralUp ? "ok" : "warn", voxtralUp ? "prêt" : "arrêté (fallback Whisper)");
  log("Ollama (résumé IA)", ollamaUp ? "ok" : "warn", ollamaUp ? "prêt" : "arrêté (CR sans résumé)");

  const ready = livekitUp && (whisperUp || voxtralUp);
  console.log(
    ready
      ? "\n✅ Pipeline de transcription opérationnel\n"
      : "\n❌ Pipeline incomplet — vérifier les services ci-dessus\n"
  );

  process.exit(ready ? 0 : 1);
}

main().catch((err) => {
  console.error("Erreur fatale :", err);
  process.exit(1);
});
