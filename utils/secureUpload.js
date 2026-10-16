const crypto = require("crypto");
const fs = require("fs");
const os = require("os");
const path = require("path");
const multer = require("multer");
const cloudinary = require("./cloudinary");
const { apiResponse } = require("./apiResponse");
const messages = require("./messages");

/*
 * Uploads for payment proofs and support tickets. These are private, so they
 * are handled more strictly than product photos:
 *
 * - temporary files go to a directory the web server never serves, under a
 *   random name that ignores whatever the client called the file;
 * - the declared type is checked, and then the file's first bytes, so a
 *   renamed script cannot pass as a picture or a voice note;
 * - each kind has its own size limit;
 * - the file is stored as an authenticated Cloudinary asset with no public
 *   URL. Only the API hands out signed links, and only to the merchant who
 *   owns it and to administrators.
 */

const MB = 1024 * 1024;
const LIMITS = { image: 5 * MB, audio: 10 * MB };

const IMAGE_TYPES = ["image/png", "image/jpeg", "image/webp"];
const AUDIO_TYPES = [
  "audio/webm", "audio/ogg", "audio/mpeg", "audio/mp3", "audio/wav", "audio/x-wav", "audio/wave",
  "audio/mp4", "audio/x-m4a", "audio/m4a", "audio/aac", "audio/x-aac",
  // Some browsers label a recorded or chosen .webm voice note as video.
  "video/webm",
];

const tempDir = path.join(os.tmpdir(), "nh-shop-private-uploads");
fs.mkdirSync(tempDir, { recursive: true, mode: 0o700 });

const baseType = (mimetype) => String(mimetype || "").split(";")[0].trim().toLowerCase();

const declaredKind = (mimetype) => {
  const type = baseType(mimetype);
  if (IMAGE_TYPES.includes(type)) return "image";
  if (AUDIO_TYPES.includes(type)) return "audio";
  return null;
};

/** What the file's first bytes say it is, as `{ kind, mime }`, or null when unrecognised. */
const sniff = (bytes) => {
  const ascii = (start, end) => bytes.subarray(start, end).toString("latin1");
  if (bytes.length >= 8 && bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return { kind: "image", mime: "image/png" };
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return { kind: "image", mime: "image/jpeg" };
  if (ascii(0, 4) === "RIFF" && ascii(8, 12) === "WEBP") return { kind: "image", mime: "image/webp" };
  if (ascii(0, 4) === "RIFF" && ascii(8, 12) === "WAVE") return { kind: "audio", mime: "audio/wav" };
  if (bytes.length >= 4 && bytes.subarray(0, 4).equals(Buffer.from([0x1a, 0x45, 0xdf, 0xa3]))) return { kind: "audio", mime: "audio/webm" };
  if (ascii(0, 4) === "OggS") return { kind: "audio", mime: "audio/ogg" };
  if (ascii(4, 8) === "ftyp") return { kind: "audio", mime: "audio/mp4" };
  if (ascii(0, 3) === "ID3") return { kind: "audio", mime: "audio/mpeg" };
  // MPEG audio or AAC frame sync.
  if (bytes.length >= 2 && bytes[0] === 0xff && (bytes[1] & 0xe0) === 0xe0) return { kind: "audio", mime: "audio/mpeg" };
  return null;
};

const readHead = async (filePath) => {
  const handle = await fs.promises.open(filePath, "r");
  try {
    const buffer = Buffer.alloc(16);
    const { bytesRead } = await handle.read(buffer, 0, 16, 0);
    return buffer.subarray(0, bytesRead);
  } finally {
    await handle.close();
  }
};

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, tempDir),
  filename: (req, file, cb) => cb(null, crypto.randomBytes(16).toString("hex")),
});

const uploader = multer({
  storage,
  limits: { fileSize: Math.max(...Object.values(LIMITS)), files: 4, fields: 20, fieldSize: 16 * 1024 },
  fileFilter: (req, file, cb) => {
    if (declaredKind(file.mimetype)) return cb(null, true);
    return cb(Object.assign(new Error("File type not allowed"), { code: "INVALID_FILE_TYPE" }));
  },
});

const uploadedFiles = (req) => Object.values(req.files || {}).flat();

/** Deletes this request's temporary files. Safe to call more than once. */
const removeTempFiles = (req) => uploadedFiles(req).forEach((file) => fs.unlink(file.path, () => {}));

/**
 * Accepts the multipart fields `fields` (multer `.fields()` format, where each
 * entry also names the `kind` it must be) and verifies every file. On any
 * problem the temporary files are removed and a clear 400 is sent.
 * Afterwards each file carries `file.kind` and `file.detectedMime`.
 */
const acceptPrivateUploads = (fields) => {
  const handler = uploader.fields(fields.map(({ name, maxCount }) => ({ name, maxCount })));
  const kindOf = Object.fromEntries(fields.map(({ name, kind }) => [name, kind]));

  return (req, res, next) =>
    handler(req, res, async (error) => {
      if (error) {
        removeTempFiles(req);
        if (error.code === "INVALID_FILE_TYPE") return apiResponse(res, 400, messages.attachmentInvalidType);
        if (error instanceof multer.MulterError) {
          if (error.code === "LIMIT_FILE_SIZE") return apiResponse(res, 400, messages.attachmentTooLarge);
          // A known field over its count, or more files than allowed in total.
          if (error.code === "LIMIT_FILE_COUNT" || (error.code === "LIMIT_UNEXPECTED_FILE" && kindOf[error.field])) {
            return apiResponse(res, 400, messages.attachmentTooMany);
          }
          return apiResponse(res, 400, messages.attachmentInvalidType);
        }
        return next(error);
      }

      try {
        for (const file of uploadedFiles(req)) {
          const expected = kindOf[file.fieldname];
          const detected = sniff(await readHead(file.path));
          if (!detected || detected.kind !== expected || declaredKind(file.mimetype) !== expected) {
            removeTempFiles(req);
            return apiResponse(res, 400, messages.attachmentInvalidType);
          }
          if (file.size > LIMITS[expected] || file.size === 0) {
            removeTempFiles(req);
            return apiResponse(res, 400, file.size === 0 ? messages.attachmentInvalidType : messages.attachmentTooLarge);
          }
          file.kind = expected;
          file.detectedMime = detected.mime;
        }
        return next();
      } catch (caught) {
        removeTempFiles(req);
        return next(caught);
      }
    });
};

/** Keeps only safe characters of the name the client gave the file, for display. */
const cleanName = (name) => String(name || "").replace(/[^\p{L}\p{N}._ -]+/gu, "").slice(0, 100);

/** Stores one verified temporary file privately and returns its attachment record. */
const storePrivateFile = async (file, folder) => {
  const resourceType = file.kind === "audio" ? "video" : "image";
  const result = await cloudinary.uploader.upload(file.path, {
    folder,
    type: "authenticated",
    resource_type: resourceType,
    use_filename: false,
    unique_filename: true,
  });
  return {
    kind: file.kind,
    publicId: result.public_id,
    resourceType,
    format: result.format || "",
    mimeType: file.detectedMime,
    bytes: result.bytes || file.size,
    originalName: cleanName(file.originalname),
  };
};

/**
 * Stores several files. If one fails, the ones already stored are removed
 * again so nothing is left behind without a record pointing at it.
 */
const storePrivateFiles = async (files, folder) => {
  const stored = [];
  try {
    for (const file of files) stored.push(await storePrivateFile(file, folder));
    return stored;
  } catch (error) {
    await destroyPrivateFiles(stored);
    throw error;
  }
};

/** Best-effort removal of stored files whose record could not be saved. */
const destroyPrivateFiles = (attachments) =>
  Promise.all(
    attachments.map((attachment) =>
      cloudinary.uploader
        .destroy(attachment.publicId, { type: "authenticated", resource_type: attachment.resourceType, invalidate: true })
        .catch(() => {})
    )
  );

/** A signed link to a private attachment, for its owner or an administrator. */
const signedUrl = (attachment) =>
  attachment?.publicId
    ? cloudinary.url(attachment.publicId, {
        type: "authenticated",
        resource_type: attachment.resourceType,
        sign_url: true,
        secure: true,
        format: attachment.format || undefined,
      })
    : "";

/** An attachment as sent to the browser: the signed link, never the storage id. */
const attachmentView = (attachment) =>
  attachment && {
    _id: attachment._id,
    kind: attachment.kind,
    url: signedUrl(attachment),
    mimeType: attachment.mimeType,
    bytes: attachment.bytes,
    originalName: attachment.originalName,
  };

module.exports = {
  LIMITS,
  acceptPrivateUploads,
  removeTempFiles,
  storePrivateFiles,
  destroyPrivateFiles,
  attachmentView,
  sniff,
};
