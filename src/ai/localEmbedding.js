// src/ai/localEmbedding.js

import path from "path";
import { fileURLToPath } from "url";
import { pipeline, env } from "@xenova/transformers";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Base models directory
const MODELS_DIR = path.resolve(__dirname, "../../models") + path.sep;

// Folder name of your VIT model: /models/vit/...
const MODEL_NAME = "vit";

// Force Xenova to use only local models
env.allowRemoteModels = false;
env.allowLocalModels = true;
env.localModelPath = MODELS_DIR;

let pipePromise = null;

// Load VIT image-feature-extraction pipeline once
async function getImageEmbeddingPipeline() {
  if (!pipePromise) {
    pipePromise = pipeline("image-feature-extraction", MODEL_NAME, {
      local_files_only: true,
    });
  }
  return pipePromise;
}

/**
 * Compute image embedding from a Telegram file_id.
 * IMPORTANT: we pass the IMAGE URL STRING directly to Xenova.
 */
export async function getImageEmbeddingFromTelegram(fileId, ctx) {
  try {
    const pipe = await getImageEmbeddingPipeline();

    const fileLink = await ctx.telegram.getFileLink(fileId);
    const imageUrl = fileLink.href;

    const result = await pipe(imageUrl, {
      pooling: "mean",
      normalize: true,
    });

    const data = Array.from(result.data || []);
    const dim = 768; // embedding size for vit-base-patch16
    const numPatches = data.length / dim;

    // Manual mean pooling
    let pooled = new Array(dim).fill(0);
    for (let i = 0; i < numPatches; i++) {
      for (let j = 0; j < dim; j++) {
        pooled[j] += data[i * dim + j];
      }
    }
    for (let j = 0; j < dim; j++) {
      pooled[j] /= numPatches;
    }

    return pooled;
  } catch (err) {
    console.log("LOCAL_EMBEDDING_ERR:", err);
    return null;
  }
}
