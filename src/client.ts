/**
 * ConvertEverything API Client
 *
 * Secure client for interacting with the ConvertEverything.io public API.
 * Only uses documented public endpoints - no internal/admin access.
 */

import * as fs from "fs";
import * as path from "path";
import {
  ClientConfig,
  ConversionResponse,
  ConversionListResponse,
  ConversionOptions,
  SupportedFormatsResponse,
  UsageResponse,
  ApiError,
  DEFAULT_BASE_URL,
  DEFAULT_TIMEOUT,
  isFormatSupported,
} from "./types.js";

export interface WaitOptions {
  pollInterval?: number;  // ms between polls (default: 2000)
  timeout?: number;       // max wait time in ms (default: 300000 = 5 min)
}

// Package version for User-Agent
const CLIENT_VERSION = "1.2.0";

// Retry configuration
const DEFAULT_MAX_RETRIES = 3;
const DEFAULT_RETRY_DELAY = 1000; // 1 second
const RETRYABLE_STATUS_CODES = [408, 429, 500, 502, 503, 504];

// Cache configuration
const FORMAT_CACHE_TTL = 3600000; // 1 hour

interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

export class ConvertEverythingClient {
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly timeout: number;
  private readonly userAgent: string;
  private readonly maxRetries: number;
  private formatCache: CacheEntry<SupportedFormatsResponse> | null = null;

  constructor(config: ClientConfig) {
    if (!config.apiKey) {
      throw new Error("API key is required");
    }

    // Validate API key format (should be ce_ prefix)
    if (!config.apiKey.startsWith("ce_")) {
      throw new Error(
        "Invalid API key format. Keys should start with 'ce_'. " +
        "Get your API key at https://converteverything.io/api-keys"
      );
    }

    this.apiKey = config.apiKey;
    this.baseUrl = this.sanitizeUrl(config.baseUrl || DEFAULT_BASE_URL);
    this.timeout = config.timeout || DEFAULT_TIMEOUT;
    this.userAgent = `converteverything-mcp/${CLIENT_VERSION} (Node.js)`;
    this.maxRetries = DEFAULT_MAX_RETRIES;
  }

  /**
   * Generate a unique correlation ID for request tracing
   */
  private generateCorrelationId(): string {
    return `mcp-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
  }

  /**
   * Calculate exponential backoff delay
   */
  private getRetryDelay(attempt: number, retryAfter?: number): number {
    if (retryAfter) {
      return retryAfter * 1000; // Convert seconds to ms
    }
    // Exponential backoff: 1s, 2s, 4s, etc.
    return DEFAULT_RETRY_DELAY * Math.pow(2, attempt);
  }

  /**
   * Sleep for specified milliseconds
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Execute fetch with timeout and abort controller
   */
  private async fetchWithTimeout(
    url: string,
    options: RequestInit = {}
  ): Promise<Response> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      return await fetch(url, {
        ...options,
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timeoutId);
    }
  }

  /**
   * Execute fetch with retry logic and rate limit handling
   */
  private async fetchWithRetry(
    url: string,
    options: RequestInit = {},
    correlationId: string
  ): Promise<Response> {
    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      try {
        const response = await this.fetchWithTimeout(url, {
          ...options,
          headers: {
            ...options.headers,
            "X-Correlation-ID": correlationId,
          },
        });

        // Handle rate limiting (429)
        if (response.status === 429) {
          const retryAfter = parseInt(response.headers.get("Retry-After") || "0", 10);
          if (attempt < this.maxRetries) {
            const delay = this.getRetryDelay(attempt, retryAfter || undefined);
            await this.sleep(delay);
            continue;
          }
          throw new Error(
            `Rate limit exceeded. Please wait ${retryAfter || 60} seconds before retrying.`
          );
        }

        // Retry on transient errors
        if (RETRYABLE_STATUS_CODES.includes(response.status) && attempt < this.maxRetries) {
          const delay = this.getRetryDelay(attempt);
          await this.sleep(delay);
          continue;
        }

        return response;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));

        // Retry on network errors
        if (attempt < this.maxRetries && lastError.name !== "AbortError") {
          const delay = this.getRetryDelay(attempt);
          await this.sleep(delay);
          continue;
        }
      }
    }

    throw lastError || new Error("Request failed after retries");
  }

  /**
   * Sanitize and validate the base URL
   */
  private sanitizeUrl(url: string): string {
    // Remove trailing slashes
    let sanitized = url.replace(/\/+$/, "");

    // Ensure HTTPS (upgrade HTTP to HTTPS for security)
    if (sanitized.startsWith("http://") && !sanitized.includes("localhost")) {
      sanitized = sanitized.replace("http://", "https://");
    }

    // Basic URL validation
    try {
      new URL(sanitized);
    } catch {
      throw new Error(`Invalid base URL: ${url}`);
    }

    return sanitized;
  }

  /**
   * Make an authenticated API request with retry and correlation ID
   */
  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${this.baseUrl}/api${endpoint}`;
    const correlationId = this.generateCorrelationId();

    const response = await this.fetchWithRetry(
      url,
      {
        ...options,
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          "User-Agent": this.userAgent,
          ...options.headers,
        },
      },
      correlationId
    );

    if (!response.ok) {
      let errorMessage = `API error: ${response.status} ${response.statusText}`;
      try {
        const errorData = (await response.json()) as ApiError;
        if (errorData.detail) {
          errorMessage = errorData.detail;
        }
      } catch {
        // Use default error message
      }
      errorMessage += ` (correlation-id: ${correlationId})`;
      throw new Error(errorMessage);
    }

    return (await response.json()) as T;
  }

  /**
   * Get list of supported conversion formats (cached for 1 hour)
   */
  async getSupportedFormats(skipCache = false): Promise<SupportedFormatsResponse> {
    // Return cached data if valid
    if (!skipCache && this.formatCache) {
      const age = Date.now() - this.formatCache.timestamp;
      if (age < FORMAT_CACHE_TTL) {
        return this.formatCache.data;
      }
    }

    // Fetch fresh data
    const data = await this.request<SupportedFormatsResponse>("/convert/formats");

    // Update cache
    this.formatCache = {
      data,
      timestamp: Date.now(),
    };

    return data;
  }

  /**
   * Clear the format cache
   */
  clearFormatCache(): void {
    this.formatCache = null;
  }

  /**
   * Get current API usage and limits
   */
  async getUsage(): Promise<UsageResponse> {
    return this.request<UsageResponse>("/user/usage");
  }

  /**
   * Get status of a conversion
   */
  async getConversionStatus(conversionId: string): Promise<ConversionResponse> {
    // Validate conversion ID format (should be UUID)
    if (!this.isValidUuid(conversionId)) {
      throw new Error("Invalid conversion ID format");
    }

    return this.request<ConversionResponse>(`/convert/${conversionId}`);
  }

  /**
   * Validate file path for security
   */
  private validateFilePath(filePath: string): string {
    // Resolve to absolute path
    const absolutePath = path.resolve(filePath);

    // Check for null bytes (path injection)
    if (absolutePath.includes("\0")) {
      throw new Error("Invalid file path: contains null bytes");
    }

    // Check file exists
    if (!fs.existsSync(absolutePath)) {
      throw new Error(`File not found: ${filePath}`);
    }

    const stats = fs.statSync(absolutePath);
    if (!stats.isFile()) {
      throw new Error(`Path is not a file: ${filePath}`);
    }

    // Resolve symlinks and verify the real path
    const realPath = fs.realpathSync(absolutePath);

    // Security: Ensure no directory traversal beyond file system root
    // The realPath should be a valid absolute path without any traversal sequences
    if (realPath.includes("..") || !path.isAbsolute(realPath)) {
      throw new Error("Invalid file path: potential directory traversal");
    }

    return realPath;
  }

  /**
   * Convert a file from a local path
   */
  async convertFile(
    filePath: string,
    targetFormat: string,
    options?: ConversionOptions
  ): Promise<ConversionResponse> {
    // Validate and get the real path
    const realPath = this.validateFilePath(filePath);

    // Validate target format
    const normalizedFormat = targetFormat.toLowerCase().replace(/^\./, "");
    if (!isFormatSupported(normalizedFormat)) {
      throw new Error(
        `Unsupported target format: ${targetFormat}. ` +
        "Use get_supported_formats to see available formats."
      );
    }

    // Read file
    const fileBuffer = fs.readFileSync(realPath);
    const fileName = path.basename(realPath);

    return this.convertFileBuffer(fileBuffer, fileName, normalizedFormat, options);
  }

  /**
   * Convert a file from a buffer/base64 data
   */
  async convertFileBuffer(
    data: Buffer | string,
    fileName: string,
    targetFormat: string,
    options?: ConversionOptions
  ): Promise<ConversionResponse> {
    // Handle base64 input
    let buffer: Buffer;
    if (typeof data === "string") {
      // Remove data URL prefix if present
      const base64Data = data.replace(/^data:[^;]+;base64,/, "");
      buffer = Buffer.from(base64Data, "base64");
    } else {
      buffer = data;
    }

    // Validate file size (max 10GB, but API will enforce actual tier limits)
    const maxSize = 10 * 1024 * 1024 * 1024; // 10GB
    if (buffer.length > maxSize) {
      throw new Error("File too large. Maximum size is 10GB.");
    }

    // Validate target format
    const normalizedFormat = targetFormat.toLowerCase().replace(/^\./, "");
    if (!isFormatSupported(normalizedFormat)) {
      throw new Error(
        `Unsupported target format: ${targetFormat}. ` +
        "Use get_supported_formats to see available formats."
      );
    }

    // Sanitize filename
    const sanitizedName = this.sanitizeFilename(fileName);

    // Build form data
    const formData = new FormData();
    const blob = new Blob([buffer]);
    formData.append("file", blob, sanitizedName);
    formData.append("output_format", normalizedFormat);

    // Add conversion options
    if (options && Object.keys(options).length > 0) {
      formData.append("options", JSON.stringify(options));
    }

    return this.request<ConversionResponse>("/convert", {
      method: "POST",
      body: formData,
    });
  }

  /**
   * Download a converted file
   */
  async downloadFile(conversionId: string): Promise<{
    data: Buffer;
    filename: string;
    contentType: string;
  }> {
    // Validate conversion ID
    if (!this.isValidUuid(conversionId)) {
      throw new Error("Invalid conversion ID format");
    }

    // First get the conversion status to get the download URL
    const status = await this.getConversionStatus(conversionId);

    if (status.status !== "completed") {
      throw new Error(
        `Conversion is not complete. Status: ${status.status}` +
        (status.error_message ? `. Error: ${status.error_message}` : "")
      );
    }

    if (!status.download_url) {
      throw new Error("Download URL not available");
    }

    // Check if download has expired
    if (status.download_expires_at) {
      const expiresAt = new Date(status.download_expires_at);
      if (expiresAt < new Date()) {
        throw new Error("Download link has expired");
      }
    }

    // Download the file
    const response = await this.fetchWithTimeout(status.download_url, {
      headers: { "User-Agent": this.userAgent },
    });

    if (!response.ok) {
      throw new Error(`Download failed: ${response.status} ${response.statusText}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Get filename from Content-Disposition header or construct from conversion info
    let filename = `converted.${status.target_format}`;
    const contentDisposition = response.headers.get("Content-Disposition");
    if (contentDisposition) {
      const match = contentDisposition.match(/filename="?([^";\n]+)"?/);
      if (match) {
        filename = match[1];
      }
    } else if (status.original_filename) {
      const baseName = status.original_filename.replace(/\.[^.]+$/, "");
      filename = `${baseName}.${status.target_format}`;
    }

    const contentType =
      response.headers.get("Content-Type") || "application/octet-stream";

    return { data: buffer, filename, contentType };
  }

  /**
   * Wait for a conversion to complete
   */
  async waitForConversion(
    conversionId: string,
    options: WaitOptions = {}
  ): Promise<ConversionResponse> {
    const pollInterval = options.pollInterval || 2000;
    const timeout = options.timeout || 300000;
    const startTime = Date.now();

    if (!this.isValidUuid(conversionId)) {
      throw new Error("Invalid conversion ID format");
    }

    while (true) {
      const status = await this.getConversionStatus(conversionId);

      if (status.status === "completed" || status.status === "failed") {
        return status;
      }

      if (Date.now() - startTime > timeout) {
        throw new Error(
          `Conversion timed out after ${timeout / 1000}s. ` +
          `Current status: ${status.status}`
        );
      }

      // Wait before next poll
      await new Promise((resolve) => setTimeout(resolve, pollInterval));
    }
  }

  /**
   * List recent conversions
   */
  async listConversions(
    page: number = 1,
    perPage: number = 10
  ): Promise<ConversionListResponse> {
    if (page < 1) page = 1;
    if (perPage < 1) perPage = 1;
    if (perPage > 100) perPage = 100;

    // Convert page/perPage to skip/limit for backend API
    const skip = (page - 1) * perPage;
    const limit = perPage;

    return this.request<ConversionListResponse>(
      `/convert/list?skip=${skip}&limit=${limit}`
    );
  }

  /**
   * Cancel/delete an in-progress or completed conversion
   */
  async cancelConversion(conversionId: string): Promise<{ success: boolean; message: string }> {
    if (!this.isValidUuid(conversionId)) {
      throw new Error("Invalid conversion ID format");
    }

    // First check the conversion status
    const status = await this.getConversionStatus(conversionId);
    if (status.status === "processing") {
      // Note: Currently the API doesn't support cancelling in-progress conversions
      // It only supports deleting completed/failed conversions
      return {
        success: false,
        message: "Cannot cancel in-progress conversion. Please wait for it to complete or fail.",
      };
    }

    try {
      await this.request<void>(`/convert/${conversionId}`, {
        method: "DELETE",
      });
      return { success: true, message: "Conversion deleted successfully" };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return { success: false, message };
    }
  }

  /**
   * Get file information/metadata
   */
  async getFileInfo(filePath: string): Promise<{
    filename: string;
    size: number;
    format: string;
    mimeType: string;
  }> {
    const realPath = this.validateFilePath(filePath);
    const stats = fs.statSync(realPath);
    const filename = path.basename(realPath);
    const ext = path.extname(filename).toLowerCase().replace(".", "");

    // Mime type mapping for common formats
    const mimeTypes: Record<string, string> = {
      // Audio
      mp3: "audio/mpeg", wav: "audio/wav", flac: "audio/flac", aac: "audio/aac",
      ogg: "audio/ogg", m4a: "audio/mp4", wma: "audio/x-ms-wma",
      // Video
      mp4: "video/mp4", avi: "video/x-msvideo", mkv: "video/x-matroska",
      mov: "video/quicktime", webm: "video/webm", wmv: "video/x-ms-wmv",
      // Image
      jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", gif: "image/gif",
      webp: "image/webp", bmp: "image/bmp", svg: "image/svg+xml", ico: "image/x-icon",
      heic: "image/heic", tiff: "image/tiff", tif: "image/tiff",
      // Document
      pdf: "application/pdf", docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      doc: "application/msword", xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      xls: "application/vnd.ms-excel", txt: "text/plain", html: "text/html", md: "text/markdown",
      // Data
      json: "application/json", csv: "text/csv", xml: "application/xml", yaml: "application/x-yaml",
    };

    return {
      filename,
      size: stats.size,
      format: ext,
      mimeType: mimeTypes[ext] || "application/octet-stream",
    };
  }

  /**
   * Estimate output file size based on conversion options
   */
  estimateOutputSize(
    inputSize: number,
    sourceFormat: string,
    targetFormat: string,
    options?: ConversionOptions
  ): { estimatedSize: number; confidence: "low" | "medium" | "high"; notes: string } {
    const src = sourceFormat.toLowerCase();
    const tgt = targetFormat.toLowerCase();

    // Base ratio estimates (these are rough approximations)
    let ratio = 1.0;
    let confidence: "low" | "medium" | "high" = "medium";
    let notes = "";

    // Audio conversions
    if (["mp3", "aac", "ogg", "opus"].includes(tgt)) {
      if (["wav", "flac", "aiff"].includes(src)) {
        // Lossless to lossy: significant compression
        const bitrate = (options as { bitrate?: string })?.bitrate || "192k";
        const kbps = parseInt(bitrate.replace("k", ""), 10) || 192;
        ratio = kbps / 1400; // WAV is roughly 1400 kbps for CD quality
        confidence = "high";
        notes = `Based on ${bitrate} bitrate`;
      }
    } else if (["wav", "flac"].includes(tgt)) {
      if (["mp3", "aac", "ogg"].includes(src)) {
        ratio = src === "mp3" ? 8 : 6; // Lossy to lossless: expansion
        confidence = "medium";
        notes = "Expanding lossy to lossless format";
      }
    }

    // Video conversions
    if (["mp4", "webm", "mkv"].includes(tgt)) {
      const crf = (options as { crf?: number })?.crf;
      if (crf !== undefined) {
        // CRF affects file size significantly
        ratio = crf < 20 ? 1.5 : crf > 28 ? 0.5 : 1.0;
        confidence = "medium";
        notes = `CRF ${crf}: ${crf < 20 ? "high quality, larger file" : crf > 28 ? "lower quality, smaller file" : "balanced"}`;
      }
    }

    // Image conversions
    if (["jpg", "jpeg", "webp"].includes(tgt)) {
      const quality = (options as { quality?: number })?.quality || 85;
      if (["png", "bmp", "tiff"].includes(src)) {
        ratio = 0.1 + (quality / 100) * 0.3; // PNG to JPG: significant compression
        confidence = "high";
        notes = `Quality ${quality}%`;
      }
    } else if (tgt === "png") {
      if (["jpg", "jpeg", "webp"].includes(src)) {
        ratio = 3; // JPG to PNG: expansion
        confidence = "medium";
        notes = "Lossless format, larger file expected";
      }
    }

    // Document conversions
    if (tgt === "pdf" && ["docx", "doc", "pptx"].includes(src)) {
      ratio = 0.8; // Usually slightly smaller
      confidence = "low";
      notes = "Depends heavily on document content";
    }

    const estimatedSize = Math.round(inputSize * ratio);

    return { estimatedSize, confidence, notes };
  }

  /**
   * Retry a failed conversion with optional new options
   */
  async retryConversion(
    conversionId: string,
    newOptions?: ConversionOptions
  ): Promise<ConversionResponse> {
    if (!this.isValidUuid(conversionId)) {
      throw new Error("Invalid conversion ID format");
    }

    // Get original conversion details
    const original = await this.getConversionStatus(conversionId);

    if (original.status !== "failed") {
      throw new Error(
        `Can only retry failed conversions. Current status: ${original.status}`
      );
    }

    // For retry, we need the original file which may no longer be available
    // This would typically need a server-side retry endpoint
    // For now, provide guidance
    throw new Error(
      `To retry conversion ${conversionId}, please re-upload the original file ` +
      `(${original.original_filename}) and convert to ${original.target_format} again. ` +
      `Original error: ${original.error_message || "Unknown"}`
    );
  }

  /**
   * Validate UUID format
   */
  private isValidUuid(id: string): boolean {
    const uuidRegex =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    return uuidRegex.test(id);
  }

  /**
   * Sanitize filename to prevent issues
   */
  private sanitizeFilename(filename: string): string {
    // Remove path components
    let name = path.basename(filename);

    // Remove null bytes and other dangerous characters
    name = name.replace(/[\x00-\x1f\x80-\x9f]/g, "");

    // Limit length
    if (name.length > 255) {
      const ext = path.extname(name);
      const base = path.basename(name, ext);
      name = base.substring(0, 255 - ext.length) + ext;
    }

    // Fallback for empty name
    if (!name || name === ".") {
      name = "file";
    }

    return name;
  }
}
