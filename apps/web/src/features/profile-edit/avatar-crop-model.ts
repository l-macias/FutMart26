import { avatarCropRectangle } from "@football/contracts";

export interface AvatarCrop {
  cropX: number;
  cropY: number;
  zoom: number;
}

export function avatarCropAfterDrag(
  image: { width: number; height: number },
  crop: AvatarCrop,
  movement: {
    deltaX: number;
    deltaY: number;
    viewportWidth: number;
    viewportHeight: number;
  },
): AvatarCrop {
  if (movement.viewportWidth <= 0 || movement.viewportHeight <= 0) return crop;
  const rectangle = avatarCropRectangle(image.width, image.height, crop);
  const centerX =
    rectangle.left +
    rectangle.width / 2 -
    (movement.deltaX / movement.viewportWidth) * rectangle.width;
  const centerY =
    rectangle.top +
    rectangle.height / 2 -
    (movement.deltaY / movement.viewportHeight) * rectangle.height;
  const minimumX = rectangle.width / 2 / image.width;
  const maximumX = 1 - minimumX;
  const minimumY = rectangle.height / 2 / image.height;
  const maximumY = 1 - minimumY;
  return {
    ...crop,
    cropX: clamp(centerX / image.width, minimumX, maximumX),
    cropY: clamp(centerY / image.height, minimumY, maximumY),
  };
}

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(Math.max(value, minimum), maximum);
}
