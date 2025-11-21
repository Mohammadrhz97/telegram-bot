import { UTApi } from "uploadthing/server";
import fs from "fs";

const ut = new UTApi({
  apiKey: process.env.UPLOADTHING_TOKEN,
});

export async function uploadToCDN(localPath, fileName) {
  try {
    const fileData = await fs.promises.readFile(localPath);

    const result = await ut.uploadFiles([
      {
        name: fileName,
        type: "image/jpeg",
        data: fileData,
      },
    ]);

    return result[0].data.url; // direct CDN URL
  } catch (err) {
    console.error("UploadThing error:", err);
    return null;
  }
}
