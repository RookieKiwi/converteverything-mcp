#!/usr/bin/env node
/**
 * ConvertEverything MCP Server
 *
 * An MCP server that enables AI assistants to convert files between 93+ formats
 * using the ConvertEverything.io API.
 *
 * Security: This server only uses the public API with user-provided API keys.
 * No internal endpoints, secrets, or admin functionality is exposed.
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ListResourcesRequestSchema,
  ReadResourceRequestSchema,
  ListPromptsRequestSchema,
  GetPromptRequestSchema,
  Tool,
  Resource,
  Prompt,
} from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import * as fs from "fs";
import * as path from "path";

import { ConvertEverythingClient } from "./client.js";
import {
  ConversionOptions,
  DEFAULT_BASE_URL,
  PRESETS,
  PRESET_CONFIGS,
  PresetName,
  getPresetOptions,
  getFormatCategory,
  getFormatsByCategory,
  FORMAT_CATEGORY_DESCRIPTIONS,
  FormatCategory,
} from "./types.js";

// ============================================================================
// Package Info
// ============================================================================

const PACKAGE_VERSION = "1.2.0";
const PACKAGE_NAME = "converteverything-mcp";

// ============================================================================
// CLI Argument Parsing
// ============================================================================

interface CliArgs {
  apiKey?: string;
  baseUrl?: string;
  help?: boolean;
  version?: boolean;
}

function parseArgs(): CliArgs {
  const args = process.argv.slice(2);
  const result: CliArgs = {};

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    const nextArg = args[i + 1];

    if (arg === "--help" || arg === "-h") {
      result.help = true;
    } else if (arg === "--version" || arg === "-v") {
      result.version = true;
    } else if ((arg === "--api-key" || arg === "-k") && nextArg) {
      result.apiKey = nextArg;
      i++;
    } else if ((arg === "--base-url" || arg === "-u") && nextArg) {
      result.baseUrl = nextArg;
      i++;
    } else if (arg.startsWith("--api-key=")) {
      result.apiKey = arg.split("=")[1];
    } else if (arg.startsWith("--base-url=")) {
      result.baseUrl = arg.split("=")[1];
    }
  }

  return result;
}

function showHelp(): void {
  console.log(`
${PACKAGE_NAME} v${PACKAGE_VERSION}

MCP server for ConvertEverything.io - Convert files between 93+ formats

USAGE:
  npx ${PACKAGE_NAME} [OPTIONS]

OPTIONS:
  -k, --api-key <key>   ConvertEverything.io API key (required)
  -u, --base-url <url>  Custom API URL (default: https://converteverything.io)
  -h, --help            Show this help message
  -v, --version         Show version number

ENVIRONMENT VARIABLES:
  CONVERTEVERYTHING_API_KEY     API key (alternative to --api-key)
  CONVERTEVERYTHING_BASE_URL    Base URL (alternative to --base-url)

EXAMPLES:
  npx ${PACKAGE_NAME} --api-key ce_your_key_here
  npx ${PACKAGE_NAME} -k ce_your_key_here

GET AN API KEY:
  1. Sign up at https://converteverything.io/register
  2. Subscribe to Silver ($9.99/mo) or Gold ($19.99/mo)
  3. Create a key at https://converteverything.io/api-keys

MORE INFO:
  https://github.com/converteverything/converteverything-mcp
`);
}

function showVersion(): void {
  console.log(`${PACKAGE_NAME} v${PACKAGE_VERSION}`);
}

const cliArgs = parseArgs();

// Handle --help and --version before anything else
if (cliArgs.help) {
  showHelp();
  process.exit(0);
}

if (cliArgs.version) {
  showVersion();
  process.exit(0);
}

// ============================================================================
// Configuration (CLI args take precedence over env vars)
// ============================================================================

const API_KEY = cliArgs.apiKey || process.env.CONVERTEVERYTHING_API_KEY;
const BASE_URL = cliArgs.baseUrl || process.env.CONVERTEVERYTHING_BASE_URL || DEFAULT_BASE_URL;

// ============================================================================
// Input Validation Schemas
// ============================================================================

const ConvertFileSchema = z.object({
  file_path: z.string().min(1).describe("Path to the file to convert"),
  target_format: z.string().min(1).max(10).describe("Target format (e.g., 'mp3', 'pdf', 'png')"),
  options: z.record(z.unknown()).optional().describe("Conversion settings"),
  preset: z.string().optional().describe("Preset name: web-optimized, high-quality, smallest-size, balanced, print-ready, archive"),
});

const ConvertBase64Schema = z.object({
  data: z.string().min(1).describe("Base64-encoded file data"),
  filename: z.string().min(1).max(255).describe("Original filename with extension"),
  target_format: z.string().min(1).max(10).describe("Target format"),
  options: z.record(z.unknown()).optional().describe("Conversion settings"),
  preset: z.string().optional().describe("Preset name"),
});

const BatchConvertSchema = z.object({
  files: z.array(z.object({
    file_path: z.string().min(1),
    target_format: z.string().min(1).max(10),
  })).min(1).max(50).describe("Array of files to convert"),
  options: z.record(z.unknown()).optional().describe("Shared conversion settings"),
  preset: z.string().optional().describe("Preset name to apply to all files"),
});

const GetConversionStatusSchema = z.object({
  conversion_id: z.string().uuid().describe("The conversion ID"),
});

const WaitForConversionSchema = z.object({
  conversion_id: z.string().uuid().describe("The conversion ID"),
  timeout: z.number().optional().describe("Max wait time in seconds (default: 300)"),
  poll_interval: z.number().optional().describe("Poll interval in seconds (default: 2)"),
});

const DownloadFileSchema = z.object({
  conversion_id: z.string().uuid().describe("The conversion ID"),
  save_path: z.string().optional().describe("Optional path to save the file"),
});

const ListConversionsSchema = z.object({
  page: z.number().optional().describe("Page number (default: 1)"),
  per_page: z.number().optional().describe("Items per page (default: 10, max: 100)"),
});

const CancelConversionSchema = z.object({
  conversion_id: z.string().uuid().describe("The conversion ID to cancel"),
});

const GetFileInfoSchema = z.object({
  file_path: z.string().min(1).describe("Path to the file to analyze"),
});

const EstimateOutputSizeSchema = z.object({
  file_path: z.string().min(1).describe("Path to the source file"),
  target_format: z.string().min(1).max(10).describe("Target format"),
  options: z.record(z.unknown()).optional().describe("Conversion options"),
  preset: z.string().optional().describe("Preset name"),
});

// ============================================================================
// Tool Definitions
// ============================================================================

const TOOLS: Tool[] = [
  {
    name: "get_supported_formats",
    description:
      "Get a list of all supported file formats for conversion, organized by category " +
      "(audio, video, image, document, ebook, data, 3d, font, archive, cad).",
    inputSchema: {
      type: "object" as const,
      properties: {},
      required: [],
    },
  },
  {
    name: "get_usage",
    description:
      "Get your current API usage statistics and limits. Shows daily conversions used, " +
      "daily limit, maximum file size for your tier, and your subscription tier.",
    inputSchema: {
      type: "object" as const,
      properties: {},
      required: [],
    },
  },
  {
    name: "list_presets",
    description:
      "List available conversion presets with their settings. " +
      "Presets: web-optimized, high-quality, smallest-size, balanced, print-ready, archive.",
    inputSchema: {
      type: "object" as const,
      properties: {},
      required: [],
    },
  },
  {
    name: "convert_file",
    description:
      "Convert a file from one format to another. Supports 93+ formats. " +
      "Use 'preset' for quick settings or 'options' for fine-grained control.",
    inputSchema: {
      type: "object" as const,
      properties: {
        file_path: { type: "string", description: "Path to the file to convert" },
        target_format: { type: "string", description: "Target format (e.g., 'mp3', 'pdf')" },
        options: { type: "object", description: "Conversion settings (bitrate, quality, etc.)" },
        preset: { type: "string", description: "Preset: web-optimized, high-quality, smallest-size, balanced, print-ready, archive" },
      },
      required: ["file_path", "target_format"],
    },
  },
  {
    name: "convert_base64",
    description:
      "Convert a file provided as base64-encoded data. Useful for in-memory files.",
    inputSchema: {
      type: "object" as const,
      properties: {
        data: { type: "string", description: "Base64-encoded file data" },
        filename: { type: "string", description: "Original filename with extension" },
        target_format: { type: "string", description: "Target format" },
        options: { type: "object", description: "Conversion settings" },
        preset: { type: "string", description: "Preset name" },
      },
      required: ["data", "filename", "target_format"],
    },
  },
  {
    name: "batch_convert",
    description:
      "Convert multiple files at once. Provide an array of file paths and target formats. " +
      "Returns conversion IDs for each file.",
    inputSchema: {
      type: "object" as const,
      properties: {
        files: {
          type: "array",
          items: {
            type: "object",
            properties: {
              file_path: { type: "string" },
              target_format: { type: "string" },
            },
            required: ["file_path", "target_format"],
          },
          description: "Array of {file_path, target_format} objects",
        },
        options: { type: "object", description: "Shared conversion settings" },
        preset: { type: "string", description: "Preset to apply to all files" },
      },
      required: ["files"],
    },
  },
  {
    name: "get_conversion_status",
    description:
      "Check the status of a conversion. Returns: pending, processing, completed, or failed.",
    inputSchema: {
      type: "object" as const,
      properties: {
        conversion_id: { type: "string", description: "The conversion ID" },
      },
      required: ["conversion_id"],
    },
  },
  {
    name: "wait_for_conversion",
    description:
      "Wait for a conversion to complete, polling until done. " +
      "Returns the final status when complete or failed.",
    inputSchema: {
      type: "object" as const,
      properties: {
        conversion_id: { type: "string", description: "The conversion ID" },
        timeout: { type: "number", description: "Max wait time in seconds (default: 300)" },
        poll_interval: { type: "number", description: "Poll interval in seconds (default: 2)" },
      },
      required: ["conversion_id"],
    },
  },
  {
    name: "download_file",
    description:
      "Download a completed conversion. Returns base64 data or saves to disk.",
    inputSchema: {
      type: "object" as const,
      properties: {
        conversion_id: { type: "string", description: "The conversion ID" },
        save_path: { type: "string", description: "Optional path to save the file" },
      },
      required: ["conversion_id"],
    },
  },
  {
    name: "list_conversions",
    description:
      "List your recent conversions with pagination.",
    inputSchema: {
      type: "object" as const,
      properties: {
        page: { type: "number", description: "Page number (default: 1)" },
        per_page: { type: "number", description: "Items per page (default: 10, max: 100)" },
      },
      required: [],
    },
  },
  {
    name: "cancel_conversion",
    description:
      "Cancel an in-progress conversion. Cannot cancel completed or failed conversions.",
    inputSchema: {
      type: "object" as const,
      properties: {
        conversion_id: { type: "string", description: "The conversion ID to cancel" },
      },
      required: ["conversion_id"],
    },
  },
  {
    name: "get_file_info",
    description:
      "Get file information including size, format, and MIME type before conversion.",
    inputSchema: {
      type: "object" as const,
      properties: {
        file_path: { type: "string", description: "Path to the file to analyze" },
      },
      required: ["file_path"],
    },
  },
  {
    name: "estimate_output_size",
    description:
      "Estimate the output file size after conversion based on format and options.",
    inputSchema: {
      type: "object" as const,
      properties: {
        file_path: { type: "string", description: "Path to the source file" },
        target_format: { type: "string", description: "Target format" },
        options: { type: "object", description: "Conversion options" },
        preset: { type: "string", description: "Preset name" },
      },
      required: ["file_path", "target_format"],
    },
  },
];

// ============================================================================
// Resource Definitions
// ============================================================================

const RESOURCES: Resource[] = [
  {
    uri: "converteverything://formats",
    name: "Supported Formats",
    description: "Complete list of all 93+ supported file formats by category",
    mimeType: "text/plain",
  },
  {
    uri: "converteverything://formats/audio",
    name: "Audio Formats",
    description: "Supported audio formats: mp3, wav, flac, aac, ogg, m4a, etc.",
    mimeType: "text/plain",
  },
  {
    uri: "converteverything://formats/video",
    name: "Video Formats",
    description: "Supported video formats: mp4, avi, mkv, mov, webm, etc.",
    mimeType: "text/plain",
  },
  {
    uri: "converteverything://formats/image",
    name: "Image Formats",
    description: "Supported image formats: jpg, png, gif, webp, svg, etc.",
    mimeType: "text/plain",
  },
  {
    uri: "converteverything://formats/document",
    name: "Document Formats",
    description: "Supported document formats: pdf, docx, xlsx, pptx, etc.",
    mimeType: "text/plain",
  },
  {
    uri: "converteverything://presets",
    name: "Conversion Presets",
    description: "Available presets: web-optimized, high-quality, smallest-size, etc.",
    mimeType: "text/plain",
  },
  {
    uri: "converteverything://subscription",
    name: "Subscription Info",
    description: "Your current subscription tier, limits, and usage",
    mimeType: "text/plain",
  },
];

// Format categories for resources (derived from types.ts)
const FORMAT_CATEGORY_KEYS: FormatCategory[] = [
  "audio", "video", "image", "document", "ebook", "data", "3d", "font", "archive", "cad"
];

// ============================================================================
// MCP Prompts
// ============================================================================

const PROMPTS: Prompt[] = [
  {
    name: "convert-for-web",
    description: "Convert files to web-optimized formats",
    arguments: [
      {
        name: "file_path",
        description: "Path to the file or folder to convert",
        required: true,
      },
    ],
  },
  {
    name: "batch-convert-folder",
    description: "Convert all files in a folder to a target format",
    arguments: [
      {
        name: "folder_path",
        description: "Path to the folder containing files",
        required: true,
      },
      {
        name: "target_format",
        description: "Target format for all files",
        required: true,
      },
    ],
  },
  {
    name: "optimize-images",
    description: "Optimize images for web or print",
    arguments: [
      {
        name: "file_path",
        description: "Path to the image or folder of images",
        required: true,
      },
      {
        name: "purpose",
        description: "Purpose: 'web' for smaller files, 'print' for high quality",
        required: false,
      },
    ],
  },
  {
    name: "convert-video-for-streaming",
    description: "Convert video to streaming-friendly format (MP4/WebM)",
    arguments: [
      {
        name: "file_path",
        description: "Path to the video file",
        required: true,
      },
      {
        name: "quality",
        description: "Quality level: 'low', 'medium', 'high'",
        required: false,
      },
    ],
  },
  {
    name: "document-to-pdf",
    description: "Convert documents to PDF format",
    arguments: [
      {
        name: "file_path",
        description: "Path to the document file",
        required: true,
      },
      {
        name: "quality",
        description: "PDF quality: 'screen', 'ebook', 'printer', 'prepress'",
        required: false,
      },
    ],
  },
];

// ============================================================================
// Server Implementation
// ============================================================================

class ConvertEverythingServer {
  private server: Server;
  private client: ConvertEverythingClient | null = null;

  constructor() {
    this.server = new Server(
      {
        name: PACKAGE_NAME,
        version: PACKAGE_VERSION,
      },
      {
        capabilities: {
          tools: {},
          resources: {},
          prompts: {},
        },
      }
    );

    this.setupHandlers();
  }

  private getClient(): ConvertEverythingClient {
    if (!this.client) {
      if (!API_KEY) {
        throw new Error(
          "API key required. Use --api-key or set CONVERTEVERYTHING_API_KEY. " +
          "Get your key at https://converteverything.io/api-keys"
        );
      }
      this.client = new ConvertEverythingClient({
        apiKey: API_KEY,
        baseUrl: BASE_URL,
      });
    }
    return this.client;
  }

  private setupHandlers(): void {
    // List available tools
    this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: TOOLS,
    }));

    // List available resources
    this.server.setRequestHandler(ListResourcesRequestSchema, async () => ({
      resources: RESOURCES,
    }));

    // Read resource content
    this.server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
      const uri = request.params.uri;
      return this.handleReadResource(uri);
    });

    // List available prompts
    this.server.setRequestHandler(ListPromptsRequestSchema, async () => ({
      prompts: PROMPTS,
    }));

    // Get prompt content
    this.server.setRequestHandler(GetPromptRequestSchema, async (request) => {
      const { name, arguments: promptArgs } = request.params;
      return this.handleGetPrompt(name, promptArgs || {});
    });

    // Handle tool calls
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      try {
        switch (name) {
          case "get_supported_formats":
            return await this.handleGetSupportedFormats();
          case "get_usage":
            return await this.handleGetUsage();
          case "list_presets":
            return this.handleListPresets();
          case "convert_file":
            return await this.handleConvertFile(args);
          case "convert_base64":
            return await this.handleConvertBase64(args);
          case "batch_convert":
            return await this.handleBatchConvert(args);
          case "get_conversion_status":
            return await this.handleGetConversionStatus(args);
          case "wait_for_conversion":
            return await this.handleWaitForConversion(args);
          case "download_file":
            return await this.handleDownloadFile(args);
          case "list_conversions":
            return await this.handleListConversions(args);
          case "cancel_conversion":
            return await this.handleCancelConversion(args);
          case "get_file_info":
            return await this.handleGetFileInfo(args);
          case "estimate_output_size":
            return await this.handleEstimateOutputSize(args);
          default:
            throw new Error(`Unknown tool: ${name}`);
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return {
          content: [{ type: "text" as const, text: `Error: ${message}` }],
          isError: true,
        };
      }
    });
  }

  private handleReadResource(uri: string) {
    let text = "";

    if (uri === "converteverything://formats") {
      text = "SUPPORTED FORMATS (93+ total)\n\n";
      for (const category of FORMAT_CATEGORY_KEYS) {
        const formats = getFormatsByCategory(category);
        const description = FORMAT_CATEGORY_DESCRIPTIONS[category];
        text += `${category.toUpperCase()}: ${formats.join(", ")}\n`;
        text += `  ${description}\n\n`;
      }
    } else if (uri === "converteverything://presets") {
      text = "CONVERSION PRESETS\n\n";
      for (const [name, config] of Object.entries(PRESET_CONFIGS)) {
        text += `${name}: ${config.description}\n`;
        for (const [category, options] of Object.entries(config.options)) {
          text += `  ${category}: ${JSON.stringify(options)}\n`;
        }
        text += "\n";
      }
    } else if (uri.startsWith("converteverything://formats/")) {
      const category = uri.replace("converteverything://formats/", "") as FormatCategory;
      if (FORMAT_CATEGORY_DESCRIPTIONS[category]) {
        const formats = getFormatsByCategory(category);
        const description = FORMAT_CATEGORY_DESCRIPTIONS[category];
        text = `${category.toUpperCase()} FORMATS\n\n`;
        text += `${description}\n\n`;
        text += `Formats: ${formats.join(", ")}\n`;
      } else {
        throw new Error(`Unknown format category: ${category}`);
      }
    } else if (uri === "converteverything://subscription") {
      // This is a dynamic resource - fetch usage info
      return this.handleSubscriptionResource(uri);
    } else {
      throw new Error(`Unknown resource: ${uri}`);
    }

    return {
      contents: [{ uri, mimeType: "text/plain", text }],
    };
  }

  private async handleSubscriptionResource(uri: string) {
    try {
      const client = this.getClient();
      const usage = await client.getUsage();

      const limitText = usage.conversions_limit === -1
        ? "Unlimited"
        : usage.conversions_limit.toString();

      const remainingText = usage.conversions_remaining === Infinity
        ? "Unlimited"
        : usage.conversions_remaining.toString();

      const text =
        `SUBSCRIPTION INFO\n\n` +
        `Tier: ${usage.tier.toUpperCase()}\n\n` +
        `Daily Conversions:\n` +
        `  Used: ${usage.conversions_used}\n` +
        `  Limit: ${limitText}\n` +
        `  Remaining: ${remainingText}\n\n` +
        `Max File Size: ${usage.max_file_size_mb} MB\n` +
        `File Retention: ${usage.file_retention_hours} hours\n\n` +
        `Upgrade: https://converteverything.io/pricing`;

      return {
        contents: [{ uri, mimeType: "text/plain", text }],
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return {
        contents: [{ uri, mimeType: "text/plain", text: `Error fetching subscription info: ${message}` }],
      };
    }
  }

  private async handleGetSupportedFormats() {
    const client = this.getClient();
    const formats = await client.getSupportedFormats();

    let text = `Supported Formats (${formats.total_formats} total):\n\n`;
    for (const [category, formatList] of Object.entries(formats.formats)) {
      if (Array.isArray(formatList) && formatList.length > 0) {
        text += `${category.toUpperCase()}: ${formatList.join(", ")}\n`;
      }
    }

    return { content: [{ type: "text" as const, text }] };
  }

  private async handleGetUsage() {
    const client = this.getClient();
    const usage = await client.getUsage();

    const limitText = usage.conversions_limit === -1
      ? "Unlimited"
      : usage.conversions_limit.toString();

    const remainingText = usage.conversions_remaining === Infinity
      ? "Unlimited"
      : usage.conversions_remaining.toString();

    const text =
      `API Usage:\n` +
      `  Tier: ${usage.tier}\n` +
      `  Daily conversions: ${usage.conversions_used} / ${limitText}\n` +
      `  Remaining: ${remainingText}\n` +
      `  Max file size: ${usage.max_file_size_mb} MB\n` +
      `  File retention: ${usage.file_retention_hours} hours`;

    return { content: [{ type: "text" as const, text }] };
  }

  private handleListPresets() {
    let text = "Available Presets:\n\n";

    for (const [name, config] of Object.entries(PRESET_CONFIGS)) {
      text += `${name}:\n  ${config.description}\n`;
      for (const [category, options] of Object.entries(config.options)) {
        text += `  ${category}: ${JSON.stringify(options)}\n`;
      }
      text += "\n";
    }

    return { content: [{ type: "text" as const, text }] };
  }

  private resolveOptions(
    targetFormat: string,
    preset?: string,
    options?: Record<string, unknown>
  ): ConversionOptions | undefined {
    let resolvedOptions: ConversionOptions | undefined = options as ConversionOptions;

    if (preset) {
      const category = getFormatCategory(targetFormat);
      if (category) {
        const presetOptions = getPresetOptions(preset as PresetName, category);
        if (presetOptions) {
          resolvedOptions = { ...presetOptions, ...options };
        }
      }
    }

    return resolvedOptions;
  }

  private async handleConvertFile(args: unknown) {
    const parsed = ConvertFileSchema.parse(args);
    const client = this.getClient();

    const options = this.resolveOptions(parsed.target_format, parsed.preset, parsed.options);
    const result = await client.convertFile(parsed.file_path, parsed.target_format, options);

    const text =
      `Conversion started:\n` +
      `  ID: ${result.id}\n` +
      `  Status: ${result.status}\n` +
      `  From: ${result.source_format} → ${result.target_format}\n` +
      `  File: ${result.original_filename}\n` +
      (parsed.preset ? `  Preset: ${parsed.preset}\n` : "") +
      `\nUse wait_for_conversion to wait for completion, or get_conversion_status to check progress.`;

    return { content: [{ type: "text" as const, text }] };
  }

  private async handleConvertBase64(args: unknown) {
    const parsed = ConvertBase64Schema.parse(args);
    const client = this.getClient();

    const options = this.resolveOptions(parsed.target_format, parsed.preset, parsed.options);
    const result = await client.convertFileBuffer(
      parsed.data,
      parsed.filename,
      parsed.target_format,
      options
    );

    const text =
      `Conversion started:\n` +
      `  ID: ${result.id}\n` +
      `  Status: ${result.status}\n` +
      `  From: ${result.source_format} → ${result.target_format}\n` +
      `  File: ${result.original_filename}\n` +
      (parsed.preset ? `  Preset: ${parsed.preset}\n` : "");

    return { content: [{ type: "text" as const, text }] };
  }

  private async handleBatchConvert(args: unknown) {
    const parsed = BatchConvertSchema.parse(args);
    const client = this.getClient();

    const results: Array<{ file: string; id?: string; error?: string }> = [];

    for (const file of parsed.files) {
      try {
        const options = this.resolveOptions(file.target_format, parsed.preset, parsed.options);
        const result = await client.convertFile(file.file_path, file.target_format, options);
        results.push({ file: file.file_path, id: result.id });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        results.push({ file: file.file_path, error: message });
      }
    }

    const successful = results.filter((r) => r.id);
    const failed = results.filter((r) => r.error);

    let text = `Batch conversion started:\n`;
    text += `  Total: ${results.length}\n`;
    text += `  Started: ${successful.length}\n`;
    text += `  Failed: ${failed.length}\n\n`;

    if (successful.length > 0) {
      text += "Conversions:\n";
      for (const r of successful) {
        text += `  ${path.basename(r.file)} → ${r.id}\n`;
      }
    }

    if (failed.length > 0) {
      text += "\nErrors:\n";
      for (const r of failed) {
        text += `  ${path.basename(r.file)}: ${r.error}\n`;
      }
    }

    return { content: [{ type: "text" as const, text }] };
  }

  private async handleGetConversionStatus(args: unknown) {
    const parsed = GetConversionStatusSchema.parse(args);
    const client = this.getClient();
    const result = await client.getConversionStatus(parsed.conversion_id);

    let text =
      `Conversion Status:\n` +
      `  ID: ${result.id}\n` +
      `  Status: ${result.status}\n` +
      `  From: ${result.source_format} → ${result.target_format}\n` +
      `  File: ${result.original_filename}\n`;

    if (result.created_at) text += `  Created: ${result.created_at}\n`;
    if (result.started_at) text += `  Started: ${result.started_at}\n`;
    if (result.completed_at) text += `  Completed: ${result.completed_at}\n`;
    if (result.error_message) text += `  Error: ${result.error_message}\n`;

    if (result.download_url) {
      text += `\nFile is ready for download. Use download_file to get the converted file.`;
      if (result.download_expires_at) {
        text += `\nDownload expires: ${result.download_expires_at}`;
      }
    }

    return { content: [{ type: "text" as const, text }] };
  }

  private async handleWaitForConversion(args: unknown) {
    const parsed = WaitForConversionSchema.parse(args);
    const client = this.getClient();

    const timeout = (parsed.timeout || 300) * 1000;
    const pollInterval = (parsed.poll_interval || 2) * 1000;

    const result = await client.waitForConversion(parsed.conversion_id, {
      timeout,
      pollInterval,
    });

    let text =
      `Conversion ${result.status}:\n` +
      `  ID: ${result.id}\n` +
      `  Status: ${result.status}\n` +
      `  From: ${result.source_format} → ${result.target_format}\n` +
      `  File: ${result.original_filename}\n`;

    if (result.completed_at) text += `  Completed: ${result.completed_at}\n`;
    if (result.error_message) text += `  Error: ${result.error_message}\n`;

    if (result.status === "completed") {
      text += `\nFile is ready! Use download_file to get the converted file.`;
    }

    return { content: [{ type: "text" as const, text }] };
  }

  private async handleDownloadFile(args: unknown) {
    const parsed = DownloadFileSchema.parse(args);
    const client = this.getClient();

    const { data, filename, contentType } = await client.downloadFile(parsed.conversion_id);

    if (parsed.save_path) {
      // Validate save path
      const savePath = path.resolve(parsed.save_path);

      // Security: Check for null bytes
      if (savePath.includes("\0")) {
        throw new Error("Invalid save path: contains null bytes");
      }

      // Security: Ensure the path doesn't contain traversal sequences after resolution
      if (savePath.includes("..")) {
        throw new Error("Invalid save path: contains directory traversal");
      }

      // Determine final path (if directory, append filename)
      const stats = fs.statSync(savePath, { throwIfNoEntry: false });
      let finalPath: string;

      if (stats?.isDirectory()) {
        // Sanitize the filename before joining
        const sanitizedFilename = path.basename(filename).replace(/[\x00-\x1f]/g, "");
        finalPath = path.join(savePath, sanitizedFilename);
      } else {
        // Ensure parent directory exists
        const parentDir = path.dirname(savePath);
        if (!fs.existsSync(parentDir)) {
          throw new Error(`Parent directory does not exist: ${parentDir}`);
        }
        finalPath = savePath;
      }

      fs.writeFileSync(finalPath, data);

      return {
        content: [{
          type: "text" as const,
          text: `File saved to: ${finalPath}\nSize: ${data.length} bytes\nType: ${contentType}`,
        }],
      };
    }

    const base64 = data.toString("base64");

    return {
      content: [{
        type: "text" as const,
        text: `Filename: ${filename}\nSize: ${data.length} bytes\nType: ${contentType}\nData (base64):\n${base64}`,
      }],
    };
  }

  private async handleListConversions(args: unknown) {
    const parsed = ListConversionsSchema.parse(args);
    const client = this.getClient();

    const result = await client.listConversions(parsed.page, parsed.per_page);

    let text = `Recent Conversions (page ${result.page}, ${result.conversions.length} of ${result.total}):\n\n`;

    if (result.conversions.length === 0) {
      text += "No conversions found.";
    } else {
      for (const conv of result.conversions) {
        text += `${conv.id}\n`;
        text += `  ${conv.original_filename}: ${conv.source_format} → ${conv.target_format}\n`;
        text += `  Status: ${conv.status}`;
        if (conv.created_at) text += ` | Created: ${conv.created_at}`;
        text += "\n\n";
      }
    }

    return { content: [{ type: "text" as const, text }] };
  }

  private async handleCancelConversion(args: unknown) {
    const parsed = CancelConversionSchema.parse(args);
    const client = this.getClient();

    const result = await client.cancelConversion(parsed.conversion_id);

    const text = result.success
      ? `✓ ${result.message}`
      : `✗ ${result.message}`;

    return { content: [{ type: "text" as const, text }] };
  }

  private async handleGetFileInfo(args: unknown) {
    const parsed = GetFileInfoSchema.parse(args);
    const client = this.getClient();

    const info = await client.getFileInfo(parsed.file_path);

    const sizeFormatted = info.size < 1024
      ? `${info.size} bytes`
      : info.size < 1024 * 1024
        ? `${(info.size / 1024).toFixed(1)} KB`
        : info.size < 1024 * 1024 * 1024
          ? `${(info.size / 1024 / 1024).toFixed(1)} MB`
          : `${(info.size / 1024 / 1024 / 1024).toFixed(2)} GB`;

    const text =
      `File Information:\n` +
      `  Name: ${info.filename}\n` +
      `  Size: ${sizeFormatted} (${info.size} bytes)\n` +
      `  Format: ${info.format.toUpperCase()}\n` +
      `  MIME Type: ${info.mimeType}`;

    return { content: [{ type: "text" as const, text }] };
  }

  private async handleEstimateOutputSize(args: unknown) {
    const parsed = EstimateOutputSizeSchema.parse(args);
    const client = this.getClient();

    const info = await client.getFileInfo(parsed.file_path);
    const options = this.resolveOptions(parsed.target_format, parsed.preset, parsed.options);
    const estimate = client.estimateOutputSize(info.size, info.format, parsed.target_format, options);

    const formatSize = (size: number) => {
      if (size < 1024) return `${size} bytes`;
      if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
      if (size < 1024 * 1024 * 1024) return `${(size / 1024 / 1024).toFixed(1)} MB`;
      return `${(size / 1024 / 1024 / 1024).toFixed(2)} GB`;
    };

    const text =
      `Output Size Estimate:\n` +
      `  Input: ${formatSize(info.size)} (${info.format.toUpperCase()})\n` +
      `  Target: ${parsed.target_format.toUpperCase()}\n` +
      `  Estimated Output: ${formatSize(estimate.estimatedSize)}\n` +
      `  Confidence: ${estimate.confidence}\n` +
      (estimate.notes ? `  Notes: ${estimate.notes}` : "");

    return { content: [{ type: "text" as const, text }] };
  }

  private handleGetPrompt(name: string, args: Record<string, string>) {
    switch (name) {
      case "convert-for-web":
        return {
          messages: [
            {
              role: "user" as const,
              content: {
                type: "text" as const,
                text: `I need to convert the file at "${args.file_path}" to a web-optimized format.

Please:
1. First use get_file_info to check the file details
2. Determine the best web format (e.g., JPG/WebP for images, MP4 for video, MP3 for audio)
3. Use the "web-optimized" preset for optimal web delivery
4. Convert the file and let me know when it's ready`,
              },
            },
          ],
        };

      case "batch-convert-folder":
        return {
          messages: [
            {
              role: "user" as const,
              content: {
                type: "text" as const,
                text: `Please convert all files in the folder "${args.folder_path}" to ${args.target_format} format.

Steps:
1. List all files in the folder
2. Filter for convertible files
3. Use batch_convert to convert them all to ${args.target_format}
4. Report the results when complete`,
              },
            },
          ],
        };

      case "optimize-images":
        const purpose = args.purpose || "web";
        const preset = purpose === "print" ? "print-ready" : "web-optimized";
        return {
          messages: [
            {
              role: "user" as const,
              content: {
                type: "text" as const,
                text: `Optimize the images at "${args.file_path}" for ${purpose} use.

Please:
1. Check the image(s) using get_file_info
2. Use the "${preset}" preset
3. Convert to the appropriate format (WebP/JPG for web, PNG/TIFF for print)
4. Report the size savings`,
              },
            },
          ],
        };

      case "convert-video-for-streaming":
        const quality = args.quality || "medium";
        const crf = quality === "high" ? 18 : quality === "low" ? 28 : 23;
        return {
          messages: [
            {
              role: "user" as const,
              content: {
                type: "text" as const,
                text: `Convert the video at "${args.file_path}" to MP4 format optimized for streaming.

Requirements:
1. Get the video file info first
2. Convert to MP4 with CRF ${crf} (${quality} quality)
3. Use the "fast" preset for quicker encoding
4. Wait for completion and report the result`,
              },
            },
          ],
        };

      case "document-to-pdf":
        const pdfQuality = args.quality || "ebook";
        return {
          messages: [
            {
              role: "user" as const,
              content: {
                type: "text" as const,
                text: `Convert the document at "${args.file_path}" to PDF format.

Settings:
1. Use PDF quality: "${pdfQuality}"
2. Convert to PDF
3. Report when complete with the file size`,
              },
            },
          ],
        };

      default:
        throw new Error(`Unknown prompt: ${name}`);
    }
  }

  async run(): Promise<void> {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error(`ConvertEverything MCP server v${PACKAGE_VERSION} running on stdio`);
  }
}

// ============================================================================
// Main Entry Point
// ============================================================================

const server = new ConvertEverythingServer();
server.run().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
