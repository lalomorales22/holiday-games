export async function api(path, body) {
  const response = await fetch(`/api${path}`, {
    credentials: "same-origin",
    ...(body !== undefined
      ? {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        }
      : {}),
  });
  const data = await response.json();
  if (!response.ok)
    throw new Error(data.error || "Something went wrong. Please try again.");
  return data;
}
export async function resizePhoto(file) {
  if (!file.type.startsWith("image/"))
    throw new Error("Choose an image for your avatar.");
  const bitmap = await createImageBitmap(file);
  const canvas = document.createElement("canvas");
  canvas.width = 192;
  canvas.height = 192;
  const context = canvas.getContext("2d");
  const side = Math.min(bitmap.width, bitmap.height);
  context.drawImage(
    bitmap,
    (bitmap.width - side) / 2,
    (bitmap.height - side) / 2,
    side,
    side,
    0,
    0,
    192,
    192,
  );
  bitmap.close();
  return canvas.toDataURL("image/jpeg", 0.82);
}
