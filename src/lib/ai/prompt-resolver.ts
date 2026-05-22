import { db } from "@/lib/db";
import { aiPrompts, aiPromptVersions } from "@/lib/db/schema-ai";
import { eq, and } from "drizzle-orm";
import { getBuiltinPromptsByUsageType } from "./builtin-prompts";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type UsageType = "chat" | "summary_doc" | "summary_meeting";

interface ResolvedPrompt {
  systemPrompt: string;
  userPromptTemplate: string | null;
  variables: unknown;
  promptId: string;
  versionId: string;
  versionNumber: number;
}

interface SystemPromptResult {
  prompt: string;
  versionId?: string;
}

// ---------------------------------------------------------------------------
// resolvePrompt — resolve from DB with A/B testing support
// ---------------------------------------------------------------------------

export async function resolvePrompt(
  usageType: UsageType,
): Promise<ResolvedPrompt | null> {
  // Find an active prompt matching the usage type
  const [prompt] = await db
    .select()
    .from(aiPrompts)
    .where(and(eq(aiPrompts.usageType, usageType), eq(aiPrompts.isActive, true)))
    .limit(1);

  if (!prompt) return null;

  // Find active versions for this prompt
  const versions = await db
    .select()
    .from(aiPromptVersions)
    .where(
      and(
        eq(aiPromptVersions.promptId, prompt.id),
        eq(aiPromptVersions.isActive, true),
      ),
    );

  if (versions.length === 0) return null;

  // A/B testing: select a version based on traffic percentages
  let selectedVersion = versions[0];

  if (versions.length > 1) {
    const rand = Math.random() * 100;
    let cumulative = 0;

    for (const version of versions) {
      cumulative += version.trafficPercentage;
      if (rand < cumulative) {
        selectedVersion = version;
        break;
      }
    }
  }

  return {
    systemPrompt: selectedVersion.systemPrompt,
    userPromptTemplate: selectedVersion.userPromptTemplate,
    variables: selectedVersion.variables,
    promptId: prompt.id,
    versionId: selectedVersion.id,
    versionNumber: selectedVersion.versionNumber,
  };
}

// ---------------------------------------------------------------------------
// getSystemPrompt — resolve from DB, fall back to hardcoded
// ---------------------------------------------------------------------------

export async function getSystemPrompt(
  usageType: UsageType,
): Promise<SystemPromptResult> {
  const resolved = await resolvePrompt(usageType);

  if (resolved) {
    return {
      prompt: resolved.systemPrompt,
      versionId: resolved.versionId,
    };
  }

  const builtins = getBuiltinPromptsByUsageType(usageType);
  const builtin = builtins[0];
  if (builtin) return { prompt: builtin.systemPrompt };

  // Should never happen — at least one builtin exists per type
  return { prompt: "" };
}

// ---------------------------------------------------------------------------
// interpolatePrompt — replace {{variable_name}} placeholders
// ---------------------------------------------------------------------------

export function interpolatePrompt(
  template: string,
  values: Record<string, string>,
): string {
  return template.replace(/\{\{(\w+)\}\}/g, (match, key: string) => {
    return key in values ? values[key] : match;
  });
}
