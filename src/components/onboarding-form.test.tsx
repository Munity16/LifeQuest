// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { OnboardingForm } from "@/components/onboarding-form";

const router = vi.hoisted(() => ({
  push: vi.fn(),
  refresh: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => router,
}));

describe("OnboardingForm", () => {
  beforeEach(() => {
    router.push.mockReset();
    router.refresh.mockReset();
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ campaignId: "00000000-0000-4000-8000-000000000001" }),
    }));
  });

  it("submits a selected daily pace as a number", async () => {
    const user = userEvent.setup();
    render(<OnboardingForm isDemo />);

    await user.click(screen.getByRole("radio", { name: "15 minutes" }));
    await user.click(screen.getByRole("button", { name: "Enter the seeded campaign" }));

    await waitFor(() => expect(fetch).toHaveBeenCalledOnce());
    const [, request] = vi.mocked(fetch).mock.calls[0];
    expect(JSON.parse(String(request?.body))).toMatchObject({ dailyMinutes: 15 });
  });
});
