import type { Metadata } from "next";
import Link from "next/link";
import { Database, Eye, ImageOff, ShieldCheck, Sparkles } from "lucide-react";
import { AppHeader } from "@/components/app-header";

export const metadata: Metadata = {
  title: "Privacy and proof handling",
  description: "How LifeQuest stores, processes, and deletes quest proof images.",
};

export default function PrivacyPage() {
  return (
    <div className="site-page app-page">
      <AppHeader publicNav />
      <main id="main-content" className="page-shell legal-page">
        <header className="legal-hero">
          <span className="eyebrow"><ShieldCheck size={15} /> Plain-language privacy</span>
          <h1>Your proof is evidence, not a trophy case.</h1>
          <p>LifeQuest uses the minimum image workflow needed to verify a quest and award progression.</p>
        </header>

        <section id="proofs" className="legal-grid" aria-labelledby="proof-heading">
          <h2 id="proof-heading" className="sr-only">Proof image lifecycle</h2>
          <article>
            <ImageOff aria-hidden="true" />
            <h3>Sanitized on upload</h3>
            <p>The server decodes your JPG, PNG, or WebP, applies orientation, limits its dimensions, and re-encodes it as a JPEG. EXIF and location metadata are not copied.</p>
          </article>
          <article>
            <Database aria-hidden="true" />
            <h3>Stored privately</h3>
            <p>The sanitized file is kept in a private bucket under your user, campaign, and quest IDs. Browser requests cannot read another user&apos;s objects.</p>
          </article>
          <article>
            <Eye aria-hidden="true" />
            <h3>Used for verification</h3>
            <p>The sanitized image is sent to the configured OpenAI APIs for safety screening and evaluation only against the quest requirements. LifeQuest does not perform face recognition or infer sensitive traits.</p>
          </article>
          <article>
            <Sparkles aria-hidden="true" />
            <h3>Receipt retained</h3>
            <p>You can delete the stored image immediately. The privacy-safe decision receipt and earned XP remain so retries cannot duplicate rewards and your campaign history stays correct.</p>
          </article>
        </section>

        <section className="legal-copy">
          <h2>Retention and deletion</h2>
          <p>Live deployments set a proof-retention period with <code>PROOF_RETENTION_DAYS</code> (30 days by default) and run the authenticated retention job. Deleting proof removes the storage object; it does not reverse a completed quest.</p>
          <h2>Demo mode</h2>
          <p>The seeded demo uses labelled, deterministic sample results. It is not a live AI verification and does not upload proof to the production verification pipeline.</p>
          <h2>Before using a live deployment</h2>
          <p>Avoid uploading identity documents, faces, precise locations, credentials, medical information, or any image you do not have permission to use.</p>
          <Link className="button button-secondary" href="/">Return home</Link>
        </section>
      </main>
    </div>
  );
}
