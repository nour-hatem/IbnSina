import type {
  ApproveGateRequest,
  ApproveGateResponse,
  CreateEncounterRequest,
  CreateEncounterResponse,
  EncounterSummary,
  GetEncounterResponse,
  RunEncounterResponse,
  UploadCXRResponse,
} from "./types";

const BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export class ApiError extends Error {
  status: number;
  body: any;

  constructor(status: number, message: string, body?: any) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.body = body;
  }
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const url = `${BASE_URL}${path}`;
  const response = await fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
  });

  let responseData: any;
  const contentType = response.headers.get("content-type");
  if (contentType && contentType.includes("application/json")) {
    responseData = await response.json();
  } else {
    responseData = await response.text();
  }

  if (!response.ok) {
    const errorMsg =
      typeof responseData === "object" && responseData?.detail
        ? typeof responseData.detail === "string"
          ? responseData.detail
          : JSON.stringify(responseData.detail)
        : `API error ${response.status}: ${response.statusText}`;

    throw new ApiError(response.status, errorMsg, responseData);
  }

  return responseData as T;
}

export async function listEncounters(): Promise<{
  encounters: EncounterSummary[];
}> {
  return request<{ encounters: EncounterSummary[] }>("/encounters", {
    method: "GET",
  });
}

export async function createEncounter(
  payload: CreateEncounterRequest
): Promise<CreateEncounterResponse> {
  return request<CreateEncounterResponse>("/encounter", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function getEncounter(
  encounterId: string
): Promise<GetEncounterResponse> {
  return request<GetEncounterResponse>(`/encounter/${encounterId}`, {
    method: "GET",
  });
}

export async function runEncounterStep(
  encounterId: string
): Promise<RunEncounterResponse> {
  return request<RunEncounterResponse>(`/encounter/${encounterId}/run`, {
    method: "POST",
  });
}

export async function approveGate(
  encounterId: string,
  payload: ApproveGateRequest
): Promise<ApproveGateResponse> {
  return request<ApproveGateResponse>(`/encounter/${encounterId}/approve`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function uploadCXR(
  encounterId: string,
  file: File
): Promise<UploadCXRResponse> {
  const url = `${BASE_URL}/upload/cxr/${encounterId}`;
  const formData = new FormData();
  formData.append("file", file);

  const response = await fetch(url, {
    method: "POST",
    body: formData,
  });

  let responseData: any;
  const contentType = response.headers.get("content-type");
  if (contentType && contentType.includes("application/json")) {
    responseData = await response.json();
  } else {
    responseData = await response.text();
  }

  if (!response.ok) {
    const errorMsg =
      typeof responseData === "object" && responseData?.detail
        ? typeof responseData.detail === "string"
          ? responseData.detail
          : JSON.stringify(responseData.detail)
        : `API error ${response.status}: ${response.statusText}`;

    throw new ApiError(response.status, errorMsg, responseData);
  }

  return responseData as UploadCXRResponse;
}
