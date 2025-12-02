# Contributing to ConvertEverything MCP

Thank you for your interest in contributing!

## Getting Started

1. Fork the repository
2. Clone your fork: `git clone https://github.com/YOUR_USERNAME/converteverything-mcp.git`
3. Install dependencies: `npm install`
4. Create a branch: `git checkout -b feature/your-feature`

## Development

```bash
# Build the project
npm run build

# Watch for changes
npm run watch

# Run in development mode
CONVERTEVERYTHING_API_KEY=ce_your_key npm run dev
```

## Testing

You'll need a valid ConvertEverything.io API key to test the MCP server.

1. Get a Silver or Gold subscription at [converteverything.io/pricing](https://converteverything.io/pricing)
2. Create an API key at [converteverything.io/api-keys](https://converteverything.io/api-keys)
3. Set the environment variable: `export CONVERTEVERYTHING_API_KEY=ce_your_key`

## Pull Request Process

1. Update the README.md with details of any new features
2. Update the CHANGELOG.md following the existing format
3. Ensure your code follows the existing style
4. Submit a pull request with a clear description

## Code Style

- Use TypeScript strict mode
- Follow existing patterns in the codebase
- Add JSDoc comments for public APIs
- Validate all user inputs with Zod schemas

## Security

If you discover a security vulnerability, please email security@converteverything.io instead of opening a public issue.

## License

By contributing, you agree that your contributions will be licensed under the MIT License.
