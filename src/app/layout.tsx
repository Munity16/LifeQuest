import type { Metadata } from "next";
import { AppearanceProvider } from "@/components/appearance-provider";
import { getAppearancePreferences } from "@/lib/appearance";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "LifeQuest — Turn goals into adventures",
    template: "%s — LifeQuest",
  },
  description: "Turn a real-life goal into a focused RPG campaign, prove each quest, and make your progress visible.",
  applicationName: "LifeQuest",
};

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const preferences = await getAppearancePreferences();
  return (
    <html
      lang="en"
      data-theme={preferences.theme}
      data-accent={preferences.accent}
      data-crest={preferences.crest}
      data-font-scale={preferences.fontScale}
      data-contrast={preferences.contrast}
      data-motion={preferences.motion}
      data-density={preferences.density}
    >
      <body>
        <AppearanceProvider initialPreferences={preferences}>
          <a className="skip-link" href="#main-content">Skip to content</a>
          {children}
        </AppearanceProvider>
      </body>
    </html>
  );
}
