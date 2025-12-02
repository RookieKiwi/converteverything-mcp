# ConvertEverything MCP Server

An MCP (Model Context Protocol) server that enables AI assistants like Claude to convert files between 93+ formats using the [ConvertEverything.io](https://converteverything.io) API.

> **"Hey Claude, convert this HEIC to JPG"** — it's that simple.

## Why ConvertEverything?

Tired of sketchy converter websites with popup ads and "premium" upsells? We built [ConvertEverything.io](https://converteverything.io) for developers and power users who want:

- **No ads, no BS** — Clean interface, fast conversions
- **Actually free tier** — 5 conversions/day, no credit card required
- **Serious file size limits** — Up to 10GB per file (try finding that elsewhere)
- **Privacy-first** — Files auto-delete, no data mining
- **API access** — Because you're reading an MCP README, you probably want this

## Features

- **93+ Supported Formats**: Audio, video, image, document, ebook, data, 3D, font, archive, and CAD files
- **Simple Integration**: Works with Claude Desktop, Claude Code, and any MCP-compatible client
- **Conversion Options**: Fine-tune output quality, resolution, bitrate, and more
- **Secure**: Uses your personal API key, no data stored on third-party servers beyond conversion processing

## Popular Conversions

Here's what people actually use this for:

| From → To | Use Case | Link |
|-----------|----------|------|
| HEIC → JPG | iPhone photos for literally anything else | [HEIC to JPG Converter](https://converteverything.io/converter/heic/jpg) |
| MOV → MP4 | iPhone videos that actually play everywhere | [MOV to MP4 Converter](https://converteverything.io/converter/mov/mp4) |
| WEBP → PNG | Google's format → universal format | [WEBP to PNG Converter](https://converteverything.io/converter/webp/png) |
| MKV → MP4 | Plex/streaming compatibility | [MKV to MP4 Converter](https://converteverything.io/converter/mkv/mp4) |
| FLAC → MP3 | Audiophile → portable | [FLAC to MP3 Converter](https://converteverything.io/converter/flac/mp3) |
| PDF → DOCX | Edit that "read-only" document | [PDF to Word Converter](https://converteverything.io/converter/pdf/docx) |
| XLSX → CSV | Excel → everything else | [Excel to CSV Converter](https://converteverything.io/converter/xlsx/csv) |
| WAV → MP3 | Studio quality → shareable | [WAV to MP3 Converter](https://converteverything.io/converter/wav/mp3) |
| PNG → ICO | Favicon time | [PNG to ICO Converter](https://converteverything.io/converter/png/ico) |
| EPUB → PDF | Ebook → printable | [EPUB to PDF Converter](https://converteverything.io/converter/epub/pdf) |

Browse all [audio converters](https://converteverything.io/audio-converters), [video converters](https://converteverything.io/video-converters), [image converters](https://converteverything.io/image-converters), and [document converters](https://converteverything.io/document-converters).

## Supported Formats

| Category | Formats |
|----------|---------|
| **Audio** | mp3, wav, flac, aac, ogg, m4a, wma, aiff, midi, opus, ac3, amr, ape |
| **Video** | mp4, avi, mkv, mov, webm, wmv, flv, m4v, 3gp, ts, vob, mts, mpeg, m2ts, divx |
| **Image** | jpg, jpeg, png, gif, webp, bmp, tiff, svg, ico, heic |
| **Document** | pdf, docx, doc, xlsx, xls, pptx, ppt, txt, md, html, rtf, odt |
| **Ebook** | epub, mobi, azw3 |
| **Data** | json, csv, xml, yaml, tsv |
| **3D** | obj, stl, ply, gltf, glb, dae, fbx, 3ds, blend, usdz, step, iges, ifc |
| **Font** | ttf, otf, woff, woff2, eot |
| **Archive** | zip, tar, gz, bz2, 7z |

## Requirements

- Node.js 18 or higher
- ConvertEverything.io API key (requires [Silver or Gold subscription](https://converteverything.io/pricing))

## Installation

### From npm (recommended)

```bash
npm install -g converteverything-mcp
```

### From source

```bash
git clone https://github.com/converteverything/converteverything-mcp.git
cd converteverything-mcp
npm install
npm run build
```

## Configuration

### 1. Get an API Key

1. Sign up at [converteverything.io](https://converteverything.io/register) (it's free)
2. Subscribe to [Silver or Gold plan](https://converteverything.io/pricing) for API access
3. Go to [API Keys](https://converteverything.io/api-keys) and create a new key
4. Copy the key (starts with `ce_`)

### 2. Client Configuration

<details>
<summary><b>Claude Desktop</b></summary>

**macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
**Windows**: `%APPDATA%\Claude\claude_desktop_config.json`

```json
{
  "mcpServers": {
    "converteverything": {
      "command": "npx",
      "args": ["-y", "converteverything-mcp", "--api-key", "ce_your_api_key_here"]
    }
  }
}
```
</details>

<details>
<summary><b>Claude Code (Anthropic CLI)</b></summary>

Add to `~/.claude/settings.json`:

```json
{
  "mcpServers": {
    "converteverything": {
      "command": "npx",
      "args": ["-y", "converteverything-mcp", "--api-key", "ce_your_api_key_here"]
    }
  }
}
```

Or add via CLI:
```bash
claude mcp add converteverything -- npx -y converteverything-mcp --api-key ce_your_key
```
</details>

<details>
<summary><b>Cursor IDE</b></summary>

Add to Cursor settings (`~/.cursor/mcp.json`):

```json
{
  "mcpServers": {
    "converteverything": {
      "command": "npx",
      "args": ["-y", "converteverything-mcp", "--api-key", "ce_your_api_key_here"]
    }
  }
}
```
</details>

<details>
<summary><b>Windsurf (Codeium)</b></summary>

Add to `~/.codeium/windsurf/mcp_config.json`:

```json
{
  "mcpServers": {
    "converteverything": {
      "command": "npx",
      "args": ["-y", "converteverything-mcp", "--api-key", "ce_your_api_key_here"]
    }
  }
}
```
</details>

<details>
<summary><b>Cline (VS Code Extension)</b></summary>

Open Cline settings in VS Code and add to MCP Servers:

```json
{
  "converteverything": {
    "command": "npx",
    "args": ["-y", "converteverything-mcp", "--api-key", "ce_your_api_key_here"]
  }
}
```
</details>

<details>
<summary><b>Zed Editor</b></summary>

Add to `~/.config/zed/settings.json`:

```json
{
  "context_servers": {
    "converteverything": {
      "command": {
        "path": "npx",
        "args": ["-y", "converteverything-mcp", "--api-key", "ce_your_api_key_here"]
      }
    }
  }
}
```
</details>

<details>
<summary><b>Continue.dev</b></summary>

Add to `~/.continue/config.json`:

```json
{
  "experimental": {
    "modelContextProtocolServers": [
      {
        "transport": {
          "type": "stdio",
          "command": "npx",
          "args": ["-y", "converteverything-mcp", "--api-key", "ce_your_api_key_here"]
        }
      }
    ]
  }
}
```
</details>

<details>
<summary><b>Manual / Generic Usage</b></summary>

Run directly from the command line:

```bash
# With API key as argument
npx converteverything-mcp --api-key ce_your_key

# With environment variable
export CONVERTEVERYTHING_API_KEY=ce_your_key
npx converteverything-mcp

# Short form
npx converteverything-mcp -k ce_your_key
```

For stdio-based integrations, the server communicates via stdin/stdout using the MCP protocol.
</details>

### Alternative: Environment Variables

All clients also support passing the API key via environment variable:

```json
{
  "mcpServers": {
    "converteverything": {
      "command": "npx",
      "args": ["-y", "converteverything-mcp"],
      "env": {
        "CONVERTEVERYTHING_API_KEY": "ce_your_api_key_here"
      }
    }
  }
}
```

### CLI Options

| Option | Short | Description |
|--------|-------|-------------|
| `--api-key` | `-k` | Your ConvertEverything.io API key |
| `--base-url` | `-u` | Custom API URL (for development) |
| `--help` | `-h` | Show help message and exit |
| `--version` | `-v` | Show version number and exit |

## Available Tools

### `get_supported_formats`

Get a list of all supported file formats organized by category.

```
User: What formats can you convert?
Claude: [Uses get_supported_formats] I can convert between 93+ formats including...
```

### `get_usage`

Check your current API usage and limits.

```
User: How many conversions do I have left today?
Claude: [Uses get_usage] You've used 5 of your 100 daily conversions...
```

### `convert_file`

Convert a file from one format to another.

```
User: Convert my-video.mov to mp4
Claude: [Uses convert_file] Starting conversion...
```

**Parameters:**
- `file_path` (required): Path to the file to convert
- `target_format` (required): Target format (e.g., "mp3", "pdf", "png")
- `options` (optional): Conversion settings (see below)

### `convert_base64`

Convert a file provided as base64 data.

**Parameters:**
- `data` (required): Base64-encoded file data
- `filename` (required): Original filename with extension
- `target_format` (required): Target format
- `options` (optional): Conversion settings

### `get_conversion_status`

Check the status of an ongoing conversion.

```
User: Is my conversion done yet?
Claude: [Uses get_conversion_status] Your conversion is complete and ready to download!
```

### `download_file`

Download a completed conversion.

**Parameters:**
- `conversion_id` (required): The conversion ID
- `save_path` (optional): Path to save the file

### `list_presets`

Get available conversion presets for quick configuration.

```
User: What presets are available?
Claude: [Uses list_presets] Here are the available presets:
- web-optimized: Smaller files, fast loading
- high-quality: Best quality, larger files
- balanced: Good quality with reasonable size
...
```

### `batch_convert`

Convert multiple files at once.

```
User: Convert all the WAV files in my project to MP3
Claude: [Uses batch_convert] Converting 5 files to MP3...
```

**Parameters:**
- `file_paths` (required): Array of file paths to convert
- `target_format` (required): Target format for all files
- `preset` (optional): Use a preset (e.g., "web-optimized")
- `options` (optional): Conversion settings

### `wait_for_conversion`

Wait for a conversion to complete with progress polling.

```
User: Convert this large video and let me know when it's done
Claude: [Uses convert_file, then wait_for_conversion] The conversion is now complete!
```

**Parameters:**
- `conversion_id` (required): The conversion ID to wait for
- `poll_interval` (optional): Milliseconds between status checks (default: 2000)
- `timeout` (optional): Max wait time in milliseconds (default: 300000)

### `list_conversions`

List your recent conversions with pagination.

```
User: Show me my recent conversions
Claude: [Uses list_conversions] Here are your last 10 conversions...
```

**Parameters:**
- `page` (optional): Page number (default: 1)
- `per_page` (optional): Results per page, 1-100 (default: 10)

### `cancel_conversion`

Delete a conversion and its associated files. Note: In-progress conversions cannot be cancelled.

```
User: Delete that failed conversion
Claude: [Uses cancel_conversion] Conversion deleted successfully.
```

**Parameters:**
- `conversion_id` (required): The conversion ID to delete

### `get_file_info`

Get file metadata before conversion (size, format, MIME type).

```
User: What's the size of this video file?
Claude: [Uses get_file_info] The file is 1.2 GB, format: MP4, MIME: video/mp4
```

**Parameters:**
- `file_path` (required): Path to the file to analyze

### `estimate_output_size`

Estimate the output file size before conversion.

```
User: How big will this WAV be as MP3?
Claude: [Uses estimate_output_size] Estimated output: ~15 MB (from 150 MB WAV at 128k bitrate)
```

**Parameters:**
- `file_path` (required): Path to the source file
- `target_format` (required): Target format
- `options` (optional): Conversion options that affect size
- `preset` (optional): Preset name

## Conversion Presets

Presets provide pre-configured conversion settings optimized for different use cases. Use them with the `preset` parameter in `convert_file`, `convert_base64`, or `batch_convert`.

| Preset | Best For | Details |
|--------|----------|---------|
| `web-optimized` | Websites, fast loading | Lower bitrates, smaller dimensions, stripped metadata |
| `high-quality` | Archival, professional use | Maximum quality settings, minimal compression |
| `smallest-size` | Email attachments, storage | Aggressive compression, smaller output |
| `balanced` | General purpose | Good quality with reasonable file sizes |
| `print-ready` | Physical printing | 300 DPI, printer-quality PDF |
| `archive` | Long-term storage | Lossless where possible, preserves quality |

### Preset Example

```
User: Convert my podcast.wav to MP3 for web
Claude: [Uses convert_file with preset: "web-optimized"]
Converting with web-optimized settings (128kbps, 44.1kHz stereo)...
```

```
User: Convert these photos for print
Claude: [Uses batch_convert with preset: "print-ready"]
Converting with print-ready settings (300 DPI, maximum quality)...
```

## Conversion Options

### Audio Options

Perfect for [MP3 conversions](https://converteverything.io/audio-converters), podcasts, and music:

```json
{
  "bitrate": "320k",
  "sample_rate": 48000,
  "channels": 2,
  "normalize": true
}
```

### Video Options

For [video format conversions](https://converteverything.io/video-converters), streaming, and social media:

```json
{
  "resolution": "1920x1080",
  "fps": 30,
  "crf": 23,
  "preset": "medium",
  "audio_bitrate": "192k",
  "remove_audio": false
}
```

### Image Options

For [image conversions](https://converteverything.io/image-converters), web optimization, and print:

```json
{
  "quality": 90,
  "max_dimension": 2048,
  "strip_metadata": true,
  "dpi": 300
}
```

### Document Options

For [PDF conversions](https://converteverything.io/document-converters) and office documents:

```json
{
  "pdf_quality": "printer",
  "page_size": "a4",
  "orientation": "portrait"
}
```

## MCP Resources

The server exposes format documentation as MCP Resources that AI assistants can read to understand supported formats.

| Resource URI | Description |
|--------------|-------------|
| `converteverything://formats` | Overview of all format categories |
| `converteverything://formats/audio` | Audio formats (mp3, wav, flac, etc.) |
| `converteverything://formats/video` | Video formats (mp4, mkv, mov, etc.) |
| `converteverything://formats/image` | Image formats (jpg, png, webp, etc.) |
| `converteverything://formats/document` | Document formats (pdf, docx, etc.) |
| `converteverything://presets` | Available conversion presets |
| `converteverything://subscription` | Your current tier, limits, and usage |

Resources allow AI assistants to have contextual knowledge about supported formats without making API calls.

## MCP Prompts

Pre-built prompts for common conversion tasks:

| Prompt | Description |
|--------|-------------|
| `convert-for-web` | Convert files to web-optimized formats |
| `batch-convert-folder` | Convert all files in a folder |
| `optimize-images` | Optimize images for web or print |
| `convert-video-for-streaming` | Convert video to streaming format |
| `document-to-pdf` | Convert documents to PDF |

## Example Conversations

### Convert an image

```
User: Convert screenshot.png to a high-quality JPEG
Claude: I'll convert that PNG to JPEG for you with high quality settings.
[Uses convert_file with options: {"quality": 95}]
The conversion is complete! Your file has been converted to JPEG.
```

### Convert a video

```
User: I need to convert this MOV file to MP4 for web use
Claude: I'll convert your MOV to MP4 with web-optimized settings.
[Uses convert_file with options: {"crf": 23, "preset": "medium"}]
Done! The MP4 is ready for download.
```

### Batch conversion

```
User: Convert all the screenshots in ~/Desktop to JPG for the web
Claude: [Uses batch_convert with preset: "web-optimized"]
Converting 12 PNG files to JPG with web-optimized settings...
All 12 conversions started. I'll monitor their progress.
[Uses wait_for_conversion for each]
All done! 12 files converted successfully.
```

### Check conversion history

```
User: What did I convert recently?
Claude: [Uses list_conversions]
Here are your last 10 conversions:
1. report.pdf → docx (completed, 2 hours ago)
2. video.mov → mp4 (completed, yesterday)
...
```

### Format inquiry

```
User: What video formats can I convert to?
Claude: [Uses get_supported_formats]
You can convert to these video formats: mp4, avi, mkv, mov, webm, wmv, flv, m4v, 3gp, ts, vob, mts, mpeg, m2ts, divx
```

## Security

This MCP server:
- Only uses the public ConvertEverything.io API
- Requires your personal API key (never shared)
- Validates all file paths to prevent directory traversal
- Sanitizes filenames before upload
- Uses HTTPS for all API communication
- Does not store any files or credentials

Your files are:
- Encrypted in transit (HTTPS/TLS)
- Processed on ConvertEverything.io servers
- Automatically deleted after your tier's retention period (6 hours to 60 days)

## Troubleshooting

### "API key is required"

Make sure you've set the `CONVERTEVERYTHING_API_KEY` environment variable in your MCP configuration.

### "Invalid API key format"

API keys must start with `ce_`. Get your key from [converteverything.io/api-keys](https://converteverything.io/api-keys).

### "Unsupported format"

Use `get_supported_formats` to see all available formats. Some format combinations may not be supported.

### "Daily limit exceeded"

Your subscription tier has a daily conversion limit. [Upgrade to Gold](https://converteverything.io/pricing) for unlimited conversions.

## Pricing

API access requires a paid subscription. Here's what you get:

| | **Silver** | **Gold** |
|---|:---:|:---:|
| **Price** | $9.99/mo | $19.99/mo |
| **Conversions/Day** | 100 | **Unlimited** |
| **Max File Size** | 5 GB | 10 GB |
| **File Retention** | 30 days | 60 days |
| **API Access** | ✅ | ✅ |
| **Priority Queue** | Normal | **High Priority** |
| **Bulk Uploads** | 25 files | 50 files |

👉 **[View Full Pricing](https://converteverything.io/pricing)**

Not ready to commit? The [free tier](https://converteverything.io/register) gives you 5 conversions/day to try it out (web only, no API).

## Development

```bash
# Clone the repository
git clone https://github.com/converteverything/converteverything-mcp.git
cd converteverything-mcp

# Install dependencies
npm install

# Build
npm run build

# Run in development mode
CONVERTEVERYTHING_API_KEY=ce_your_key npm run dev
```

## License

MIT License - see [LICENSE](LICENSE) for details.

## Links

- 🏠 [ConvertEverything.io](https://converteverything.io) — Main site
- 📖 [API Documentation](https://converteverything.io/docs) — Full API docs
- 🔑 [Get API Key](https://converteverything.io/api-keys) — Manage your keys
- 💰 [Pricing](https://converteverything.io/pricing) — Plans & features
- 🐛 [GitHub Issues](https://github.com/converteverything/converteverything-mcp/issues) — Report bugs
- 📧 [Contact](https://converteverything.io/contact) — Get in touch

---

<p align="center">
  <b>Built with 🔧 by the <a href="https://converteverything.io">ConvertEverything.io</a> team</b><br>
  <sub>Because life's too short for format incompatibility.</sub>
</p>
