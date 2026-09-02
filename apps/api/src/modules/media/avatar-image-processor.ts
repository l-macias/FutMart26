import sharp from "sharp";

import { ApplicationError } from "../errors.js";

export const AVATAR_INPUT_MAX_BYTES = 8 * 1024 * 1024;
export const AVATAR_WIDTH = 800;
export const AVATAR_HEIGHT = 1000;
const MAX_INPUT_PIXELS = 40_000_000;
const MIN_INPUT_EDGE = 320;
const OUTPUT_MIME_TYPE = "image/webp";

const inputMimeByFormat = {
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
} as const;

export interface ProcessedAvatar {
  body: Buffer;
  mimeType: typeof OUTPUT_MIME_TYPE;
  width: typeof AVATAR_WIDTH;
  height: typeof AVATAR_HEIGHT;
}

export async function processAvatar(input: {
  body: Buffer;
  claimedMimeType: string;
  crop: { cropX: number; cropY: number; zoom: number };
}): Promise<ProcessedAvatar> {
  if (input.body.byteLength > AVATAR_INPUT_MAX_BYTES)
    throw new ApplicationError(
      "media_too_large",
      "Avatar exceeds the input byte limit",
      413,
    );
  const textHeader = input.body
    .subarray(0, Math.min(input.body.byteLength, 1024))
    .toString("utf8")
    .trimStart()
    .toLowerCase();
  if (
    textHeader.startsWith("<svg") ||
    (textHeader.startsWith("<?xml") && textHeader.includes("<svg"))
  )
    throw new ApplicationError(
      "media_format_not_allowed",
      "SVG avatars are not allowed",
      415,
    );

  try {
    const decoded = sharp(input.body, {
      animated: false,
      failOn: "warning",
      limitInputPixels: MAX_INPUT_PIXELS,
    });
    const metadata = await decoded.metadata();
    const expectedMime =
      metadata.format &&
      inputMimeByFormat[metadata.format as keyof typeof inputMimeByFormat];
    if (!expectedMime)
      throw new ApplicationError(
        "media_format_not_allowed",
        "Avatar format is not allowed",
        415,
      );
    if (input.claimedMimeType !== expectedMime)
      throw new ApplicationError(
        "media_format_not_allowed",
        "Avatar content does not match its declared MIME type",
        415,
      );

    const rotated = await decoded
      .rotate()
      .toBuffer({ resolveWithObject: true });
    if (
      rotated.info.width < MIN_INPUT_EDGE ||
      rotated.info.height < MIN_INPUT_EDGE
    )
      throw new ApplicationError(
        "media_dimensions_invalid",
        "Avatar dimensions are too small",
        422,
      );

    const extraction = cropRectangle(
      rotated.info.width,
      rotated.info.height,
      input.crop,
    );
    const rendition = await sharp(rotated.data, {
      limitInputPixels: MAX_INPUT_PIXELS,
    })
      .extract(extraction)
      .resize(AVATAR_WIDTH, AVATAR_HEIGHT, { fit: "fill" })
      .webp({ quality: 82, effort: 4 })
      .toBuffer();

    return {
      body: rendition,
      mimeType: OUTPUT_MIME_TYPE,
      width: AVATAR_WIDTH,
      height: AVATAR_HEIGHT,
    };
  } catch (error) {
    if (error instanceof ApplicationError) throw error;
    throw new ApplicationError(
      "media_processing_failed",
      "Avatar could not be decoded or processed",
      422,
    );
  }
}

function cropRectangle(
  width: number,
  height: number,
  crop: { cropX: number; cropY: number; zoom: number },
) {
  const targetRatio = AVATAR_WIDTH / AVATAR_HEIGHT;
  const baseWidth = Math.min(width, Math.floor(height * targetRatio));
  const baseHeight = Math.min(height, Math.floor(baseWidth / targetRatio));
  const cropWidth = Math.max(1, Math.floor(baseWidth / crop.zoom));
  const cropHeight = Math.max(1, Math.floor(baseHeight / crop.zoom));
  return {
    left: clamp(
      Math.round(crop.cropX * width - cropWidth / 2),
      0,
      width - cropWidth,
    ),
    top: clamp(
      Math.round(crop.cropY * height - cropHeight / 2),
      0,
      height - cropHeight,
    ),
    width: cropWidth,
    height: cropHeight,
  };
}

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(Math.max(value, minimum), maximum);
}
