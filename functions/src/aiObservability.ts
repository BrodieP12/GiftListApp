import { randomUUID } from "crypto";
import { GoogleGenAI } from "@google/genai";
import { GoogleGenAI as PostHogGoogleGenAI } from "@posthog/ai/gemini";
import { PostHog } from "posthog-node";

const projectToken = process.env.POSTHOG_API_KEY;
const host = process.env.POSTHOG_HOST;

if (process.env.NODE_ENV !== "production") {
    for (const variable of ["POSTHOG_API_KEY", "POSTHOG_HOST"] as const) {
        if (!process.env[variable]) {
            console.warn(
                `${variable} variable required by PostHog is missing or un-configured, this causes events to be silently missed. This error stops appearing once ${variable} is configured`
            );
        }
    }
}

const posthog = projectToken && host
    ? new PostHog(projectToken, {
        host,
        logs: {
            serviceName: "giftlist-functions",
            environment: process.env.NODE_ENV,
        },
        privacyMode: false,
        enableExceptionAutocapture: false,
        flushAt: 1,
        flushInterval: 0,
        requestTimeout: 2000,
        fetchRetryCount: 0,
    })
    : undefined;

export function createVertexAIClient() {
    posthog?.logger.info("vertex_ai_generation_requested", {
        provider: "vertex_ai",
    });

    const options = {
        vertexai: true,
        project: process.env.GCLOUD_PROJECT,
        location: process.env.FIREBASE_REGION || "us-central1",
    };

    return posthog
        ? new PostHogGoogleGenAI({ ...options, posthog })
        : new GoogleGenAI(options);
}

export function createAiGenerationContext() {
    return {
        posthogTraceId: randomUUID(),
        posthogProperties: {
            $ai_session_id: randomUUID(),
        },
    };
}

export async function flushPostHog() {
    await posthog?.flush().catch(() => {});
}
