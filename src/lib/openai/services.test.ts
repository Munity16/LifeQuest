import { beforeEach, describe, expect, it, vi } from "vitest";
import { AppError } from "@/lib/errors";
import { getOpenAIClient } from "@/lib/openai/client";
import { generateCampaignWithAI, moderateProofImage, verifyProofWithAI } from "@/lib/openai/services";

vi.mock("@/lib/openai/client", () => ({
  getOpenAIClient: vi.fn(),
  getOpenAIModel: vi.fn(() => "gpt-5.6"),
  getOpenAIModerationModel: vi.fn(() => "omni-moderation-latest"),
}));

const parse = vi.fn();
const moderate = vi.fn();
const validCampaign = {
  campaignName: "The Python Citadel",
  heroName: "Code Apprentice",
  enemyName: "Delay Demon",
  enemyDescription: "A shadow that feeds on postponed practice and unfinished lessons.",
  story: "Recover the foundations of Python through focused work and break the delay demon's hold.",
  quests: [1, 2, 3, 4, 5, 6, 7].map((sequenceNumber) => ({
    dayNumber: sequenceNumber,
    sequenceNumber,
    title: `Python Quest ${sequenceNumber}`,
    storyIntro: "A practical coding rune waits to be restored.",
    description: "Write a short Python program and run it successfully.",
    difficulty: "balanced" as const,
    estimatedMinutes: 30,
    xpReward: 30,
    enemyDamage: 15,
    proofType: "image" as const,
    successRequirements: ["Python code and successful output are visible"],
    isBossQuest: sequenceNumber === 7,
  })),
};

beforeEach(() => {
  parse.mockReset();
  moderate.mockReset();
  vi.mocked(getOpenAIClient).mockReturnValue({ responses: { parse }, moderations: { create: moderate } } as never);
});

describe("OpenAI campaign generation", () => {
  it("returns validated structured output", async () => {
    parse.mockResolvedValueOnce({ output_parsed: validCampaign });
    await expect(generateCampaignWithAI({ goal: "Learn Python fundamentals", dailyMinutes: 30, mainObstacle: "procrastination", difficulty: "balanced" })).resolves.toEqual(validCampaign);
  });

  it("retries malformed output and returns a bounded application error", async () => {
    parse.mockResolvedValue({ output_parsed: { campaignName: "broken" } });
    await expect(generateCampaignWithAI({ goal: "Learn Python fundamentals", dailyMinutes: 30, mainObstacle: "procrastination", difficulty: "balanced" })).rejects.toMatchObject({ code: "AI_GENERATION_FAILED", status: 502 } satisfies Partial<AppError>);
    expect(parse).toHaveBeenCalledTimes(2);
  });

  it("rejects quests that exceed the user's daily time", async () => {
    parse.mockResolvedValue({ output_parsed: validCampaign });
    await expect(generateCampaignWithAI({ goal: "Learn Python fundamentals", dailyMinutes: 15, mainObstacle: "procrastination", difficulty: "balanced" })).rejects.toMatchObject({ code: "AI_GENERATION_FAILED" });
  });
});

describe("OpenAI proof verification", () => {
  const input = { quest: { title: "Run Python", description: "Run a Python file.", successRequirements: ["Code and output are visible"] }, imageDataUrl: "data:image/png;base64,iVBORw0KGgo=" };

  it("returns a validated rejected assessment", async () => {
    const result = { verified: false, confidence: 0.32, reason: "The image is too blurry to verify.", requirementsAssessment: [{ requirement: input.quest.successRequirements[0], satisfied: false, explanation: "No readable output can be seen." }] };
    parse.mockResolvedValueOnce({ output_parsed: result });
    await expect(verifyProofWithAI(input)).resolves.toEqual(result);
  });

  it("rejects an internally inconsistent accepted assessment", async () => {
    parse.mockResolvedValue({ output_parsed: { verified: true, confidence: 0.9, reason: "Accepted despite missing output.", requirementsAssessment: [{ requirement: input.quest.successRequirements[0], satisfied: false, explanation: "The output is not visible." }] } });
    await expect(verifyProofWithAI(input)).rejects.toMatchObject({ code: "AI_VERIFICATION_FAILED" });
    expect(parse).toHaveBeenCalledTimes(2);
  });
});

describe("OpenAI proof moderation", () => {
  it("returns flagged categories without exposing image content", async () => {
    moderate.mockResolvedValueOnce({
      id: "modr_123",
      model: "omni-moderation-latest",
      results: [{ flagged: true, categories: { violence: true, harassment: false } }],
    });
    await expect(moderateProofImage("data:image/png;base64,iVBORw0KGgo=")).resolves.toEqual({
      flagged: true,
      categories: ["violence"],
      requestId: "modr_123",
      model: "omni-moderation-latest",
    });
  });

  it("fails closed when safety screening is unavailable", async () => {
    moderate.mockRejectedValueOnce(new Error("network unavailable"));
    await expect(moderateProofImage("data:image/png;base64,iVBORw0KGgo=")).rejects.toMatchObject({ code: "AI_MODERATION_FAILED" });
  });
});
