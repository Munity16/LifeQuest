import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "LifeQuest — Turn goals into adventures",
    template: "%s — LifeQuest",
  },
  description: "Turn a real-life goal into a focused RPG campaign, prove each quest, and make your progress visible.",
  applicationName: "LifeQuest",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <a className="skip-link" href="#main-content">Skip to content</a>
        {children}
      </body>
    </html>
  );
}
