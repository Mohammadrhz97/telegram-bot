import { UTApi } from "uploadthing/server";
import fs from "fs";

// Init UploadThing client with API key from env
const ut = new UTApi({
  apiKey: process.env.UPLOADTHING_TOKEN,
});

/**
 * Upload a local file to the CDN and return its direct URL.
 * - Reads file into memory (Buffer)
 * - Sends to UploadThing in the expected format
 * - Returns the first uploaded file's URL
 */
export async function uploadToCDN(localPath, fileName) {
  try {
    // Read file into buffer (async)
    const fileData = await fs.promises.readFile(localPath);

    // Upload to UploadThing
    const result = await ut.uploadFiles([
      {
        name: fileName, // client-side filename
        type: "image/jpeg", // MIME type, hardcoded here
        data: fileData, // file content
      },
    ]);

    // Return direct CDN URL for the first file
    return result[0].data.url;
  } catch (err) {
    // Log and fail gracefully
    console.error("UploadThing error:", err);
    return null;
  }
}
