import {GoogleGenAI} from "@google/genai";
// @ts-expect-error Classic resolution misses this package export.
import {GoogleGenAI as PostHogGoogleGenAI} from "@posthog/ai/gemini";
import {PostHog} from "posthog-node";
import {randomUUID} from "crypto";

const projectToken = process.env.POSTHOG_PROJECT_TOKEN;
const host = process.env.POSTHOG_HOST;
const isPostHogConfigured = Boolean(projectToken && host);

if (!projectToken && process.env.NODE_ENV !== "production") {
  console.warn(
    "POSTHOG_PROJECT_TOKEN variable required by PostHog is missing or " +
    "un-configured, this causes events to be silently missed. This error " +
    "stops appearing once POSTHOG_PROJECT_TOKEN is configured"
  );
}

if (!host && process.env.NODE_ENV !== "production") {
  console.warn(
    "POSTHOG_HOST variable required by PostHog is missing or un-configured, " +
    "this causes events to be silently missed. This error stops appearing " +
    "once POSTHOG_HOST is configured"
  );
}

const posthog = isPostHogConfigured ?
  new PostHog(projectToken as string, {
    host: host as string,
    privacyMode: false,
    flushAt: 1,
    flushInterval: 0,
    requestTimeout: 2000,
    fetchRetryCount: 0,
    enableExceptionAutocapture: false,
  }) :
  undefined;

const sessionId = `firebase-functions-${process.pid}`;
const vertexAiConfig = {
  vertexai: true,
  project: process.env.GCLOUD_PROJECT,
  location: process.env.FIREBASE_REGION || "us-central1",
};

/** Creates the configured Gemini client for a function invocation. */
export function createGeminiClient() {
  return posthog ?
    new PostHogGoogleGenAI({...vertexAiConfig, posthog}) :
    new GoogleGenAI(vertexAiConfig);
}

/** Creates trace and session properties for one AI request. */
export function createAiObservabilityContext() {
  return {
    posthogTraceId: randomUUID(),
    posthogProperties: {
      $ai_session_id: sessionId,
    },
  };
}

/** Flushes queued AI events without failing the application request. */
export async function flushPostHog() {
  if (posthog) {
    await posthog.flush().catch(() => undefined);
  }
}
