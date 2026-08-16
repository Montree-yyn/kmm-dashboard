"use client";

import { getDownloadURL, ref, uploadBytes } from "firebase/storage";
import { auth } from "../firebase";
import { storage } from "../firebase-storage";
import type {
  CompanyManagementResponse,
  CompanySettingsSnapshot,
} from "./types";
import { resolveActiveCompanyId } from "../company-context/client-store";

type ApiErrorPayload = {
  error?: string;
  details?: Record<string, string> | null;
};

export class CompanyApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly details: Record<string, string> = {},
  ) {
    super(message);
  }
}

export async function loadCompanyManagement(companyId?: string) {
  return companyRequest<CompanyManagementResponse>("/api/company-management", {}, companyId);
}

export async function saveCompanyDraft(snapshot: CompanySettingsSnapshot, companyId?: string) {
  return companyRequest<CompanyManagementResponse>("/api/company-management", {
    method: "POST",
    body: JSON.stringify({ action: "save_draft", snapshot }),
  }, companyId);
}

export async function publishCompanyDraft(companyId?: string) {
  return companyRequest<CompanyManagementResponse>("/api/company-management", {
    method: "POST",
    body: JSON.stringify({ action: "publish" }),
  }, companyId);
}

export async function recordLogoAudit(
  action: "company.logo_uploaded" | "company.logo_removed",
  oldValue: string,
  newValue: string,
  companyId?: string,
) {
  await companyRequest("/api/company-management", {
    method: "POST",
    body: JSON.stringify({ action, oldValue, newValue }),
  }, companyId);
}

export async function uploadCompanyLogo(file: File): Promise<string> {
  if (!["image/png", "image/jpeg", "image/svg+xml"].includes(file.type)) {
    throw new CompanyApiError("Use a PNG, JPG, or SVG logo.", 422);
  }
  if (file.size > 5 * 1024 * 1024) {
    throw new CompanyApiError("Logo files must be 5 MB or smaller.", 422);
  }

  const user = auth.currentUser;
  if (!user) throw new CompanyApiError("Authentication is required.", 401);
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]+/g, "-");
  const logoRef = ref(
    storage,
    `company-assets/${user.uid}/${Date.now()}-${safeName}`,
  );
  await uploadBytes(logoRef, file, {
    contentType: file.type,
    customMetadata: { uploadedBy: user.uid },
  });
  return getDownloadURL(logoRef);
}

async function companyRequest<T = { ok: true }>(
  input: string,
  init: RequestInit = {},
  companyId?: string,
): Promise<T> {
  const user = auth.currentUser;
  if (!user) throw new CompanyApiError("Authentication is required.", 401);
  const token = await user.getIdToken();
  const resolvedCompanyId = resolveActiveCompanyId(companyId);
  const response = await fetch(input, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...(resolvedCompanyId ? { "X-Company-Id": resolvedCompanyId } : {}),
      ...init.headers,
    },
    cache: "no-store",
  });

  const payload = (await response.json()) as T & ApiErrorPayload;
  if (!response.ok) {
    throw new CompanyApiError(
      payload.error ?? "Company Management request failed.",
      response.status,
      payload.details ?? {},
    );
  }
  return payload;
}
