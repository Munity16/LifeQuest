import { InlineLoader } from "@/components/states";

export default function Loading() {
  return <main className="route-state" aria-live="polite"><InlineLoader label="Opening the quest log..." /></main>;
}
