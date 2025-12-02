/**
 * ConvertEverything MCP Server Types
 *
 * Type definitions for the ConvertEverything.io API
 */

// ============================================================================
// API Response Types
// ============================================================================

export interface ApiError {
  detail: string;
}

export interface SupportedFormatsResponse {
  formats: FormatCategories;
  total_formats: number;
}

export interface FormatCategories {
  audio: string[];
  video: string[];
  image: string[];
  document: string[];
  ebook: string[];
  data: string[];
  "3d": string[];
  font: string[];
  archive: string[];
  cad: string[];
}

export type FormatCategory = keyof FormatCategories;

export interface ConversionResponse {
  id: string;
  status: ConversionStatus;
  source_format: string;
  target_format: string;
  original_filename: string;
  created_at: string;
  started_at?: string;
  completed_at?: string;
  error_message?: string;
  download_url?: string;
  download_expires_at?: string;
}

export type ConversionStatus =
  | "pending"
  | "processing"
  | "completed"
  | "failed"
  | "expired";

export interface UsageResponse {
  conversions_used: number;
  conversions_limit: number; // -1 for unlimited
  conversions_remaining: number;
  storage_used_bytes: number;
  storage_used_mb: number;
  max_file_size_bytes: number;
  max_file_size_mb: number;
  file_retention_hours: number;
  tier: string;
}

// ============================================================================
// Conversion Options
// ============================================================================

export interface AudioOptions {
  bitrate?: string;      // e.g., "128k", "192k", "320k"
  sample_rate?: number;  // e.g., 44100, 48000
  channels?: number;     // 1 for mono, 2 for stereo
  normalize?: boolean;
}

export interface VideoOptions {
  resolution?: string;   // e.g., "1920x1080", "1280x720"
  fps?: number;          // e.g., 24, 30, 60
  crf?: number;          // Quality: 0-51, lower is better
  preset?: string;       // e.g., "ultrafast", "fast", "medium", "slow"
  audio_bitrate?: string;
  remove_audio?: boolean;
}

export interface ImageOptions {
  quality?: number;      // 1-100
  max_dimension?: number;
  strip_metadata?: boolean;
  dpi?: number;
  ico_size?: number;     // For ICO output: 16, 32, 48, 64, 128, 256
}

export interface DocumentOptions {
  pdf_quality?: string;  // "screen", "ebook", "printer", "prepress"
  page_size?: string;    // "a4", "letter", "legal"
  orientation?: string;  // "portrait", "landscape"
}

export interface EbookOptions {
  epub_version?: string;
  embed_fonts?: boolean;
  smarten_punctuation?: boolean;
}

export type ConversionOptions =
  | AudioOptions
  | VideoOptions
  | ImageOptions
  | DocumentOptions
  | EbookOptions
  | Record<string, unknown>;

// ============================================================================
// Conversion Presets
// ============================================================================

export type PresetName =
  | "web-optimized"
  | "high-quality"
  | "smallest-size"
  | "balanced"
  | "print-ready"
  | "archive";

export interface PresetConfig {
  description: string;
  options: Record<string, ConversionOptions>;
}

export const PRESET_CONFIGS: Record<PresetName, PresetConfig> = {
  "web-optimized": {
    description: "Smaller files optimized for web delivery",
    options: {
      audio: { bitrate: "128k", sample_rate: 44100, channels: 2 },
      video: { crf: 28, preset: "fast", resolution: "1280x720" },
      image: { quality: 80, max_dimension: 1920, strip_metadata: true },
      document: { pdf_quality: "screen" },
    },
  },
  "high-quality": {
    description: "Maximum quality, larger file sizes",
    options: {
      audio: { bitrate: "320k", sample_rate: 48000, channels: 2 },
      video: { crf: 18, preset: "slow" },
      image: { quality: 95, strip_metadata: false },
      document: { pdf_quality: "prepress" },
    },
  },
  "smallest-size": {
    description: "Aggressive compression for minimum file size",
    options: {
      audio: { bitrate: "64k", sample_rate: 22050, channels: 1 },
      video: { crf: 35, preset: "ultrafast", resolution: "854x480" },
      image: { quality: 60, max_dimension: 1024, strip_metadata: true },
      document: { pdf_quality: "screen" },
    },
  },
  "balanced": {
    description: "Good balance of quality and file size",
    options: {
      audio: { bitrate: "192k", sample_rate: 44100, channels: 2 },
      video: { crf: 23, preset: "medium" },
      image: { quality: 85, strip_metadata: false },
      document: { pdf_quality: "ebook" },
    },
  },
  "print-ready": {
    description: "Optimized for printing (300 DPI, high quality)",
    options: {
      image: { quality: 100, dpi: 300, strip_metadata: false },
      document: { pdf_quality: "printer", page_size: "a4" },
    },
  },
  "archive": {
    description: "Archival quality, preserves maximum detail",
    options: {
      audio: { bitrate: "320k", sample_rate: 48000 },
      video: { crf: 15, preset: "veryslow" },
      image: { quality: 100, strip_metadata: false },
      document: { pdf_quality: "prepress" },
    },
  },
};

// Legacy export for backward compatibility
export const PRESETS: Record<PresetName, Record<string, ConversionOptions>> = Object.fromEntries(
  Object.entries(PRESET_CONFIGS).map(([name, config]) => [name, config.options])
) as Record<PresetName, Record<string, ConversionOptions>>;

/**
 * Get preset options for a given format category
 */
export function getPresetOptions(
  preset: PresetName,
  formatCategory: string
): ConversionOptions | undefined {
  const presetConfig = PRESETS[preset];
  if (!presetConfig) return undefined;

  // Map format category to preset key
  const categoryMap: Record<string, string> = {
    audio: "audio",
    video: "video",
    image: "image",
    document: "document",
    ebook: "document",
  };

  const key = categoryMap[formatCategory];
  return key ? presetConfig[key] : undefined;
}

// ============================================================================
// Conversion History
// ============================================================================

export interface ConversionListResponse {
  conversions: ConversionResponse[];
  total: number;
  page: number;
  per_page: number;
}

// ============================================================================
// Client Configuration
// ============================================================================

export interface ClientConfig {
  apiKey: string;
  baseUrl?: string;
  timeout?: number;
}

export const DEFAULT_BASE_URL = "https://converteverything.io";
export const DEFAULT_TIMEOUT = 300000; // 5 minutes for large file uploads

// ============================================================================
// Format Metadata
// ============================================================================

// Descriptions for each format category
export const FORMAT_CATEGORY_DESCRIPTIONS: Record<FormatCategory, string> = {
  audio: "Audio formats for music, podcasts, and sound effects",
  video: "Video formats for streaming, editing, and archiving",
  image: "Image formats for web, print, and photography",
  document: "Document formats for office, publishing, and data",
  ebook: "Ebook formats for readers and tablets",
  data: "Data interchange formats",
  "3d": "3D model formats for printing, gaming, and CAD",
  font: "Font formats for web and desktop",
  archive: "Archive and compression formats",
  cad: "CAD drawing formats",
};

export const FORMAT_CATEGORIES: Record<string, FormatCategory> = {
  // Audio
  mp3: "audio", wav: "audio", flac: "audio", aac: "audio", ogg: "audio",
  m4a: "audio", wma: "audio", aiff: "audio", midi: "audio", mid: "audio",
  opus: "audio", ac3: "audio", amr: "audio", ape: "audio",
  // Video
  mp4: "video", avi: "video", mkv: "video", mov: "video", webm: "video",
  wmv: "video", flv: "video", m4v: "video", "3gp": "video", ts: "video",
  vob: "video", mts: "video", mpeg: "video", m2ts: "video", divx: "video",
  // Image
  jpg: "image", jpeg: "image", png: "image", gif: "image", webp: "image",
  bmp: "image", tiff: "image", tif: "image", svg: "image", ico: "image", heic: "image",
  // Document
  pdf: "document", docx: "document", doc: "document", xlsx: "document",
  xls: "document", pptx: "document", ppt: "document", txt: "document",
  md: "document", html: "document", htm: "document", rtf: "document",
  odt: "document", odp: "document", ods: "document", docm: "document",
  xlsm: "document",
  // Ebook
  epub: "ebook", mobi: "ebook", azw3: "ebook",
  // Data
  json: "data", csv: "data", xml: "data", yaml: "data", yml: "data", tsv: "data",
  // 3D
  obj: "3d", stl: "3d", ply: "3d", gltf: "3d", glb: "3d", dae: "3d",
  off: "3d", fbx: "3d", "3ds": "3d", blend: "3d", usdz: "3d",
  step: "3d", stp: "3d", iges: "3d", igs: "3d", ifc: "3d",
  // Font
  ttf: "font", otf: "font", woff: "font", woff2: "font", eot: "font",
  // Archive
  zip: "archive", tar: "archive", gz: "archive", bz2: "archive", "7z": "archive",
  // CAD
  dxf: "cad",
};

/**
 * Get the category for a given format
 */
export function getFormatCategory(format: string): FormatCategory | undefined {
  return FORMAT_CATEGORIES[format.toLowerCase()];
}

/**
 * Check if a format is supported
 */
export function isFormatSupported(format: string): boolean {
  return format.toLowerCase() in FORMAT_CATEGORIES;
}

/**
 * Get all formats for a given category
 */
export function getFormatsByCategory(category: FormatCategory): string[] {
  return Object.entries(FORMAT_CATEGORIES)
    .filter(([_, cat]) => cat === category)
    .map(([format]) => format)
    .sort();
}

/**
 * Get format info for a category (formats + description)
 */
export function getFormatCategoryInfo(category: FormatCategory): { formats: string[]; description: string } {
  return {
    formats: getFormatsByCategory(category),
    description: FORMAT_CATEGORY_DESCRIPTIONS[category],
  };
}
