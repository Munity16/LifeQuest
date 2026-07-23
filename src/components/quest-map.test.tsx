// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { QuestMap } from "@/components/quest-map";
import type { QuestView } from "@/lib/types";

function quest(sequenceNumber: number, status: QuestView["status"]): QuestView {
  return {
    id: `00000000-0000-4000-8000-00000000010${sequenceNumber}`,
    campaignId: "00000000-0000-4000-8000-000000000001",
    dayNumber: sequenceNumber,
    sequenceNumber,
    title: status === "locked" ? "Locked Quest" : status === "completed" ? "Completed Quest" : "Available Quest",
    storyIntro: "A path opens before the hero.",
    description: "Complete one practical objective and record the result.",
    difficulty: "balanced",
    estimatedMinutes: 30,
    xpReward: 30,
    enemyDamage: 15,
    successRequirements: ["The result is visible"],
    status,
  isAdaptive: false,
  isBossQuest: false,
    completedAt: status === "completed" ? "2026-07-19T00:00:00.000Z" : null,
  };
}

describe("QuestMap", () => {
  it("links playable quests while keeping locked quests non-interactive", () => {
    render(<QuestMap quests={[quest(1, "available"), quest(2, "locked"), quest(3, "completed")]} />);

    expect(screen.getByRole("link", { name: /Available Quest/ })).toHaveAttribute("href", expect.stringContaining("000000000101"));
    expect(screen.getByLabelText("Locked Quest, locked")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Completed Quest/ })).toHaveTextContent("Victory");
  });
});
