import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, extname, resolve } from "node:path";
import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import { z } from "zod";

const proofSchema = z.object({
  verified: z.boolean(),
  confidence: z.number().min(0).max(1),
  reason: z.string().min(5).max(500),
  requirementsAssessment: z.array(z.object({ requirement: z.string(), satisfied: z.boolean(), explanation: z.string().min(3).max(300) })).min(1).max(5),
});
const caseSchema = z.object({
  id: z.string().min(1),
  quest: z.object({ title: z.string().min(1), description: z.string().min(1), successRequirements: z.array(z.string().min(1)).min(1).max(5) }),
  imagePath: z.string().min(1),
  expectedVerified: z.boolean(),
  note: z.string().optional(),
});
const prompt = `You verify image evidence for a LifeQuest task.
Judge only whether the visible evidence reasonably satisfies the supplied requirements.
Do not identify people, perform face recognition, infer sensitive traits, or use hidden metadata.
Reject unrelated, unreadable, clearly fabricated, or insufficient evidence.
An image existing is not enough. Explain the decision clearly and assess every requirement.
Set verified=true only when the visible evidence is persuasive. Keep the reason concise and practical.`;

function parseArgs(values) {
  const args = { input: "evals/proof-verification.template.jsonl", output: null, validate: false, help: false };
  for (let index = 0; index < values.length; index += 1) {
    const value = values[index];
    if (value === "--input") args.input = values[++index];
    else if (value === "--output") args.output = values[++index];
    else if (value === "--validate") args.validate = true;
    else if (value === "--help" || value === "-h") args.help = true;
    else throw new Error(`Unknown argument: ${value}`);
  }
  return args;
}

async function loadCases(inputPath) {
  const source = await readFile(inputPath, "utf8");
  const lines = source.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const cases = lines.map((line, index) => {
    try { return caseSchema.parse(JSON.parse(line)); }
    catch (error) { throw new Error(`Invalid eval case on line ${index + 1}: ${error instanceof Error ? error.message : "validation failed"}`); }
  });
  if (!cases.length) throw new Error("The eval manifest contains no cases.");
  const ids = new Set(cases.map((item) => item.id));
  if (ids.size !== cases.length) throw new Error("Every eval case must have a unique id.");
  return cases;
}

function mimeFor(path) {
  const extension = extname(path).toLowerCase();
  if (extension === ".jpg" || extension === ".jpeg") return "image/jpeg";
  if (extension === ".png") return "image/png";
  if (extension === ".webp") return "image/webp";
  throw new Error("Eval images must be JPG, PNG, or WebP.");
}

function summarize(results, model, moderationModel) {
  const passed = results.filter((item) => item.predictedVerified === item.expectedVerified).length;
  const falseAccepts = results.filter((item) => item.predictedVerified && !item.expectedVerified).length;
  const falseRejects = results.filter((item) => !item.predictedVerified && item.expectedVerified).length;
  const completed = results.filter((item) => !item.error);
  const latency = completed.length ? Math.round(completed.reduce((sum, item) => sum + item.latencyMs, 0) / completed.length) : 0;
  return {
    generatedAt: new Date().toISOString(),
    model,
    moderationModel,
    confidenceThreshold: 0.72,
    totals: { cases: results.length, completed: completed.length, errors: results.length - completed.length },
    metrics: { accuracy: results.length ? Number((passed / results.length).toFixed(4)) : 0, falseAccepts, falseRejects, meanLatencyMs: latency },
    cases: results,
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    console.log("Usage: node scripts/run-proof-evals.mjs [--input manifest.jsonl] [--output report.json] [--validate]");
    return;
  }
  const inputPath = resolve(args.input);
  const cases = await loadCases(inputPath);
  const missing = [];
  for (const item of cases) {
    try { await readFile(resolve(dirname(inputPath), item.imagePath)); }
    catch { missing.push({ id: item.id, imagePath: item.imagePath }); }
  }
  if (args.validate) {
    console.log(JSON.stringify({ validManifest: true, cases: cases.length, missingPrivateImages: missing }, null, 2));
    return;
  }
  if (missing.length) throw new Error(`Missing ${missing.length} private eval image(s). Run with --validate for the case list.`);
  if (!process.env.OPENAI_API_KEY) throw new Error("OPENAI_API_KEY is required for a live proof evaluation run.");

  const model = process.env.OPENAI_MODEL?.trim() || "gpt-5.6";
  const moderationModel = process.env.OPENAI_MODERATION_MODEL?.trim() || "omni-moderation-latest";
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY, timeout: 45_000, maxRetries: 1 });
  const results = [];
  for (const item of cases) {
    const started = Date.now();
    try {
      const absoluteImagePath = resolve(dirname(inputPath), item.imagePath);
      const bytes = await readFile(absoluteImagePath);
      if (bytes.length <= 0 || bytes.length > 5 * 1024 * 1024) throw new Error("Image size is outside the 1 byte to 5 MB boundary.");
      const imageDataUrl = `data:${mimeFor(absoluteImagePath)};base64,${bytes.toString("base64")}`;
      const moderation = await openai.moderations.create({ model: moderationModel, input: [{ type: "image_url", image_url: { url: imageDataUrl } }] });
      const flagged = moderation.results[0]?.flagged ?? true;
      let prediction = { verified: false, confidence: 0, requirementsAssessment: [] };
      if (!flagged) {
        const requirements = item.quest.successRequirements.map((value, index) => `${index + 1}. ${value}`).join("\n");
        const response = await openai.responses.parse({
          model,
          instructions: prompt,
          input: [{ role: "user", content: [{ type: "input_text", text: `Quest: ${item.quest.title}\nTask: ${item.quest.description}\nVisible proof requirements:\n${requirements}` }, { type: "input_image", image_url: imageDataUrl, detail: "high" }] }],
          text: { format: zodTextFormat(proofSchema, "proof_verification") },
        });
        prediction = proofSchema.parse(response.output_parsed);
      }
      const predictedVerified = !flagged && prediction.verified && prediction.confidence >= 0.72 && prediction.requirementsAssessment.every((assessment) => assessment.satisfied);
      results.push({ id: item.id, expectedVerified: item.expectedVerified, predictedVerified, confidence: prediction.confidence, safety: flagged ? "flagged" : "passed", requirementsSatisfied: prediction.requirementsAssessment.filter((assessment) => assessment.satisfied).length, requirementsTotal: item.quest.successRequirements.length, latencyMs: Date.now() - started });
    } catch (error) {
      results.push({ id: item.id, expectedVerified: item.expectedVerified, predictedVerified: false, confidence: 0, safety: "error", requirementsSatisfied: 0, requirementsTotal: item.quest.successRequirements.length, latencyMs: Date.now() - started, error: error instanceof Error ? error.name : "EvaluationError" });
    }
  }
  const report = summarize(results, model, moderationModel);
  console.log(JSON.stringify(report, null, 2));
  if (args.output) {
    const outputPath = resolve(args.output);
    await mkdir(dirname(outputPath), { recursive: true });
    await writeFile(outputPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  }
  if (report.totals.errors > 0) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : "Proof evaluation failed.");
  process.exitCode = 1;
});
