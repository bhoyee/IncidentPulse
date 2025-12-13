import crypto from "node:crypto";
import fs from "node:fs";
import { promises as fsp } from "node:fs";
import path from "node:path";
import type { MultipartFile } from "@fastify/multipart";
import { env } from "../env";

export const uploadsRoot = path.resolve(process.cwd(), env.UPLOAD_DIR);
const INCIDENT_FOLDER = "incidents";
const SUPPORT_FOLDER = "support";
export const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024; // 10 MB

export const ALLOWED_ATTACHMENT_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/gif",
  "image/webp",
  "image/svg+xml",
  "application/pdf",
  "text/plain",
  "text/csv",
  "application/json",
  "application/zip",
  "application/x-zip-compressed",
  "application/octet-stream"
]);

export function ensureUploadsRootSync(): void {
  if (!fs.existsSync(uploadsRoot)) {
    fs.mkdirSync(uploadsRoot, { recursive: true });
  }
}

function sanitizeFileName(filename: string): string {
  const baseName = path.parse(filename).name.replace(/[^a-z0-9-_]/gi, "-") || "attachment";
  const extension = path.extname(filename).replace(/[^a-z0-9.]/gi, "") || "";
  const uniqueSuffix = crypto.randomBytes(4).toString("hex");
  return `${Date.now()}-${uniqueSuffix}-${baseName.substring(0, 40)}${extension}`.toLowerCase();
}

export async function persistIncidentAttachment(
  file: MultipartFile,
  incidentId: string
): Promise<{
  relativePath: string;
  storedFilename: string;
  originalFilename: string;
  mimeType: string;
  size: number;
}> {
  const buffer = await file.toBuffer();
  if (buffer.byteLength === 0) {
    throw new Error("File is empty");
  }
  if (buffer.byteLength > MAX_ATTACHMENT_BYTES) {
    throw new Error("File exceeds maximum size");
  }
  if (file.mimetype && !ALLOWED_ATTACHMENT_TYPES.has(file.mimetype)) {
    throw new Error("File type is not supported");
  }

  const incidentDir = path.join(uploadsRoot, INCIDENT_FOLDER, incidentId);
  await fsp.mkdir(incidentDir, { recursive: true });

  const storedFilename = sanitizeFileName(file.filename ?? "attachment");
  const absolutePath = path.join(incidentDir, storedFilename);
  await fsp.writeFile(absolutePath, buffer);

  const relativePath = path
    .relative(uploadsRoot, absolutePath)
    .split(path.sep)
    .join("/");

  return {
    relativePath,
    storedFilename,
    originalFilename: file.filename ?? storedFilename,
    mimeType: file.mimetype || "application/octet-stream",
    size: buffer.byteLength
  };
}

export async function persistSupportAttachment(
  file: MultipartFile,
  ticketId: string
): Promise<{
  relativePath: string;
  storedFilename: string;
  originalFilename: string;
  mimeType: string;
  size: number;
}> {
  const buffer = await file.toBuffer();
  if (buffer.byteLength === 0) {
    throw new Error("File is empty");
  }
  if (buffer.byteLength > MAX_ATTACHMENT_BYTES) {
    throw new Error("File exceeds maximum size");
  }
  if (file.mimetype && !ALLOWED_ATTACHMENT_TYPES.has(file.mimetype)) {
    throw new Error("File type is not supported");
  }

  const ticketDir = path.join(uploadsRoot, SUPPORT_FOLDER, ticketId);
  await fsp.mkdir(ticketDir, { recursive: true });

  const storedFilename = sanitizeFileName(file.filename ?? "attachment");
  const absolutePath = path.join(ticketDir, storedFilename);
  await fsp.writeFile(absolutePath, buffer);

  const relativePath = path.relative(uploadsRoot, absolutePath).split(path.sep).join("/");

  return {
    relativePath,
    storedFilename,
    originalFilename: file.filename ?? storedFilename,
    mimeType: file.mimetype || "application/octet-stream",
    size: buffer.byteLength
  };
}

export async function persistSupportAttachmentBuffer(
  buffer: Buffer,
  ticketId: string,
  opts: { filename?: string; mimeType?: string } = {}
): Promise<{
  relativePath: string;
  storedFilename: string;
  originalFilename: string;
  mimeType: string;
  size: number;
}> {
  if (buffer.byteLength === 0) {
    throw new Error("File is empty");
  }
  if (buffer.byteLength > MAX_ATTACHMENT_BYTES) {
    throw new Error("File exceeds maximum size");
  }
  const mimeType = opts.mimeType || "application/octet-stream";
  if (mimeType && !ALLOWED_ATTACHMENT_TYPES.has(mimeType)) {
    throw new Error("File type is not supported");
  }

  const ticketDir = path.join(uploadsRoot, SUPPORT_FOLDER, ticketId);
  await fsp.mkdir(ticketDir, { recursive: true });

  const storedFilename = sanitizeFileName(opts.filename ?? "attachment");
  const absolutePath = path.join(ticketDir, storedFilename);
  await fsp.writeFile(absolutePath, buffer);

  const relativePath = path.relative(uploadsRoot, absolutePath).split(path.sep).join("/");

  return {
    relativePath,
    storedFilename,
    originalFilename: opts.filename ?? storedFilename,
    mimeType,
    size: buffer.byteLength
  };
}

export function buildAttachmentUrl(relativePath: string): string {
  const normalized = relativePath.replace(/\\/g, "/");
  return `/uploads/${normalized}`;
}

export async function removeAttachmentFile(relativePath: string): Promise<void> {
  const absolutePath = path.join(uploadsRoot, relativePath);
  try {
    await fsp.unlink(absolutePath);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
      throw error;
    }
  }
}

export async function removeIncidentUploads(incidentId: string): Promise<void> {
  const targetDir = path.join(uploadsRoot, INCIDENT_FOLDER, incidentId);
  try {
    await fsp.rm(targetDir, { recursive: true, force: true });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
      throw error;
    }
  }
}
