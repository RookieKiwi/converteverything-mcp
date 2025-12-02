# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.2.0] - 2025-12-02

### Added

- **New Tools**:
  - `cancel_conversion` - Cancel an in-progress conversion
  - `get_file_info` - Get file metadata (size, format, MIME type)
  - `estimate_output_size` - Estimate converted file size
- **MCP Prompts** - Pre-built prompts for common tasks:
  - `convert-for-web` - Convert files to web-optimized formats
  - `batch-convert-folder` - Convert all files in a folder
  - `optimize-images` - Optimize images for web or print
  - `convert-video-for-streaming` - Convert video to streaming format
  - `document-to-pdf` - Convert documents to PDF
- **Subscription Resource** - `converteverything://subscription` shows current tier, usage, limits
- **Retry Logic** - Automatic retry with exponential backoff for transient failures
- **Rate Limit Handling** - Graceful handling of 429 responses with Retry-After support
- **Format Cache** - Cached format list (1 hour TTL) reduces API calls
- **Request Correlation ID** - Unique ID in every request for debugging

### Changed

- Client now uses `fetchWithRetry()` for all API calls
- Error messages include correlation ID for debugging
- Version bumped to 1.2.0

## [1.1.0] - 2025-12-02

### Added

- **New Tools**:
  - `list_presets` - Get available conversion presets
  - `batch_convert` - Convert multiple files at once
  - `wait_for_conversion` - Poll and wait for conversion completion
  - `list_conversions` - List recent conversions with pagination
- **Conversion Presets**: 6 built-in presets for common use cases:
  - `web-optimized` - Smaller files, fast loading
  - `high-quality` - Maximum quality settings
  - `smallest-size` - Aggressive compression
  - `balanced` - Good quality with reasonable size
  - `print-ready` - 300 DPI, printer-quality output
  - `archive` - Lossless preservation
- **MCP Resources**: Format documentation exposed as readable resources:
  - `converteverything://formats` - All format categories
  - `converteverything://formats/audio` - Audio formats
  - `converteverything://formats/video` - Video formats
  - `converteverything://formats/image` - Image formats
  - `converteverything://formats/document` - Document formats
  - `converteverything://formats/data` - Data formats
- **CLI Improvements**:
  - `--help` / `-h` flag with usage examples
  - `--version` / `-v` flag
- **Client Improvements**:
  - `waitForConversion()` method with configurable polling
  - `listConversions()` method with pagination

### Changed

- Preset parameter now available on `convert_file` and `convert_base64` tools
- Improved help output with environment variable documentation

## [1.0.0] - 2025-12-02

### Added

- Initial release
- `get_supported_formats` - List all 93+ supported file formats
- `get_usage` - Check API usage and limits
- `convert_file` - Convert files from local filesystem
- `convert_base64` - Convert files from base64 data
- `get_conversion_status` - Check conversion progress
- `download_file` - Download completed conversions
- Support for conversion options (quality, bitrate, resolution, etc.)
- Comprehensive input validation and error handling
- Security: Path traversal prevention, filename sanitization, HTTPS enforcement
