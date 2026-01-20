# Simulation Sandbox API

A powerful GitHub repository automation service built with Fastify and TypeScript that streamlines the creation, population, and promotion of rule-based repositories. This service is designed for the Tazama Financial Risk Management System (FRMS) to automate the lifecycle management of transaction monitoring rules.

---

## Table of Contents

- [Overview](#-overview)
- [Features](#-features)
- [Architecture](#-architecture)
- [Getting Started](#-getting-started)
- [API Endpoints](#-api-endpoints)
- [Postman Collection](#-postman-collection)
- [Configuration](#-configuration)
- [Development](#-development)
- [Testing](#-testing)
- [Project Structure](#-project-structure)
- [License](#-license)

---

## Overview

### What is Simulation Sandbox?

The **Simulation Sandbox API** is an automation service that manages the complete lifecycle of rule repositories in GitHub. It provides a RESTful API to:

1. **Bootstrap**: Create new rule repositories from templates
2. **Populate**: Add rule logic and test code to repositories
3. **Promote**: Create new branches for different deployment environments

### Who is this for?

- **Technical Users**: Developers and DevOps engineers who need to automate GitHub repository workflows
- **Non-Technical Users**: Product managers and rule analysts who can use this service through simple API calls without needing to understand Git operations

### Why use this service?

Instead of manually:
- Creating repositories from templates
- Updating package.json files
- Committing code files
- Creating branches

You can now do all of this programmatically through simple REST API calls!

---

## Features

### Core Functionality

- Repository Bootstrapping: Automatically create new repositories from a predefined template
- Code Population: Inject rule logic and test code directly into repositories
- Branch Promotion: Create new branches (dev, staging, production) from base branches
- Secure Authentication: Token-based authentication using GitHub Personal Access Tokens
- Swagger Documentation: Interactive API documentation at `/docs`
- Health Monitoring: Built-in health check endpoints
- Fast Performance: Built on Fastify, one of the fastest Node.js frameworks
- Type Safety: Full TypeScript implementation with schema validation

### Technical Highlights

- Schema Validation: Request/response validation using TypeBox and Zod
- Error Handling: Comprehensive error handling with detailed logging
- CORS Support: Cross-Origin Resource Sharing enabled
- Security Headers: Helmet integration for security best practices
- Pretty Logging: Pino logger with pretty formatting for development
- Docker Support: Containerized deployment ready

---

## Architecture

### Technology Stack

- **Runtime**: Node.js
- **Framework**: Fastify v5.6.2
- **Language**: TypeScript v5.9.3
- **Schema Validation**: TypeBox v0.34.47 + Zod v3.24.0
- **API Documentation**: @fastify/swagger + @fastify/swagger-ui
- **Testing**: Jest v29.7.0
- **Logging**: Pino with pino-pretty
- **Linting**: ESLint v9 + Prettier

### Key Components

```
┌─────────────────┐
│   Client        │
│  (Postman/Web)  │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Fastify Server │
│   (Port 3000)   │
└────────┬────────┘
         │
         ▼
┌─────────────────┐      ┌──────────────┐
│   Router        │─────▶│  Controllers │
└─────────────────┘      └──────┬───────┘
                                │
                                ▼
                         ┌──────────────┐
                         │   Services   │
                         │  (GitHub API)│
                         └──────┬───────┘
                                │
                                ▼
                         ┌──────────────┐
                         │  GitHub API  │
                         └──────────────┘
```

---

## Getting Started

### Prerequisites

- Node.js: v18 or higher
- npm: v9 or higher
- GitHub Account: With a Personal Access Token (PAT)
- GitHub Template Repository: A template repository to bootstrap from

### Installation

1. Clone the repository
   ```bash
   git clone https://github.com/yourusername/Simulation-Sandbox.git
   cd Simulation-Sandbox
   ```

2. Install dependencies
   ```bash
   npm install
   ```

3. Configure environment variables

   Create a `.env` file in the root directory:
   ```env
   # Server Configuration
   PORT=3000
   NODE_ENV=development

   # GitHub Configuration
   GITHUB_DEFAULT_BRANCH=main
   GITHUB_TEMPLATE_REPO=rule-template
   GITHUB_TEMPLATE_OWNER=your-github-organization

   # Logging
   LOG_LEVEL=info
   ```

4. Run the development server
   ```bash
   npm run dev
   ```

   The server will start at `http://localhost:3000`

5. Access Swagger Documentation
   
   Open your browser and navigate to:
   ```
   http://localhost:3000/docs
   ```

### Docker Deployment

```bash
# Build the Docker image
docker build -t simulation-sandbox .

# Run the container
docker run -p 3000:3000 --env-file .env simulation-sandbox
```

Or use Docker Compose:
```bash
docker-compose up
```

---

## API Endpoints

### Base URL
```
http://localhost:3000/api
```

### 1. Health Check

Check if the service is running.

**Endpoint**: `GET /health`

**Response**:
```json
{
  "status": "ok",
  "timestamp": "2026-01-20T10:30:00.000Z"
}
```

---

### 2. Bootstrap Rule Repository

Creates a new repository from a template and initializes it with proper configuration.

**Endpoint**: `POST /v1/bootstrap`

**Headers**:
```
Content-Type: application/json
Authorization: Bearer <your_github_token>
```

**Request Body**:
```json
{
  "ruleId": "021",
  "ruleVersion": "1.0.0",
  "organization": "your-github-org"
}
```

**Request Fields**:
- `ruleId` (string, required): Unique identifier for the rule (e.g., "021", "002")
- `ruleVersion` (string, required): Semantic version of the rule (e.g., "1.0.0")
- `organization` (string, required): GitHub organization or username where the repo will be created

**Response** (200 OK):
```json
{
  "success": true,
  "repoUrl": "https://github.com/your-github-org/rule-021",
  "message": "Created your-github-org/rule-021 v1.0.0"
}
```

**What happens behind the scenes**:
1. Creates a new repository from the template repository
2. Waits for the repository content to be available
3. Updates the `package.json` with correct name and version
4. Returns the URL of the newly created repository

**Error Response** (500 Internal Server Error):
```json
{
  "success": false,
  "message": "Error description here"
}
```

---

### 3. Populate Rule Repository

Adds or updates rule logic and test code in an existing repository.

**Endpoint**: `POST /v1/populate`

**Headers**:
```
Content-Type: application/json
Authorization: Bearer <your_github_token>
```

**Request Body**:
```json
{
  "organization": "your-github-org",
  "ruleId": "021",
  "ruleCode": "Ly8gU1BEWC1MaWNlbnNlLUlkZW50aWZpZXI6IEFwYWNoZS0yLjAKCmV4cG9ydCBjb25zdCBoZWxsbyA9ICgpID0+ICdIZWxsbyBXb3JsZCc7Cg==",
  "testCode": "aW1wb3J0IHsgaGVsbG8gfSBmcm9tICcuLi8uLi9zcmMvcnVsZS0wMjEnOwoKZGVzY3JpYmUoJ3J1bGUtMDIxJywgKCkgPT4gewogIHRlc3QoJ2hlbGxvJywgKCkgPT4gewogICAgZXhwZWN0KGhlbGxvKCkpLnRvQmUoJ0hlbGxvIFdvcmxkJyk7CiAgfSk7Cn0pOwo="
}
```

**Request Fields**:
- `organization` (string, required): GitHub organization or username
- `ruleId` (string, required): The rule identifier (must match an existing repo)
- `ruleCode` (string, required): Base64-encoded rule TypeScript code
- `testCode` (string, required): Base64-encoded test TypeScript code

**Response** (200 OK):
```json
{
  "success": true,
  "message": "Populated your-github-org/rule-021 on main"
}
```

**What happens behind the scenes**:
1. Decodes the base64-encoded rule and test code
2. Updates `src/rule.ts` with the new rule logic
3. Updates `__tests__/unit/rule.test.ts` with the new test code
4. Commits both files to the repository

**Example Code Encoding**:

Rule code (`src/rule.ts`):
```typescript
// SPDX-License-Identifier: Apache-2.0

export const hello = () => 'Hello World';
```

Test code (`__tests__/unit/rule.test.ts`):
```typescript
import { hello } from '../../src/rule-021';

describe('rule-021', () => {
  test('hello', () => {
    expect(hello()).toBe('Hello World');
  });
});
```

To encode your code to base64:
```javascript
// In Node.js or browser console
const ruleCode = Buffer.from(`// SPDX-License-Identifier: Apache-2.0

export const hello = () => 'Hello World';
`).toString('base64');

console.log(ruleCode);
```

---

### 4. Promote Rule Repository

Creates a new branch in the repository for different environments (dev, staging, production).

**Endpoint**: `POST /v1/promote`

**Headers**:
```
Content-Type: application/json
Authorization: Bearer <your_github_token>
```

**Request Body**:
```json
{
  "organization": "your-github-org",
  "ruleId": "021",
  "branchName": "dev"
}
```

**Request Fields**:
- `organization` (string, required): GitHub organization or username
- `ruleId` (string, required): The rule identifier
- `branchName` (string, required): Name of the new branch to create (e.g., "dev", "staging", "production")

**Response** (200 OK):
```json
{
  "success": true,
  "message": "Branch dev created from staging"
}
```

**What happens behind the scenes**:
1. Checks if a `staging` branch exists (preferred base)
2. Falls back to the default branch (usually `main`) if staging doesn't exist
3. Creates a new branch with the specified name from the base branch
4. Returns confirmation of branch creation

**Common Use Cases**:
- Create a `dev` branch for development work
- Create a `staging` branch for pre-production testing
- Create a `production` branch for production deployments
- Create feature branches for specific implementations

---

## Postman Collection

A complete Postman collection is included in the `/postman` directory for easy API testing.

### Import the Collection

1. Open Postman
2. Click Import button
3. Navigate to `postman/Simulation Sandbox API.postman_collection.json`
4. Import the environment file: `postman/local.postman_environment.json`

### Collection Structure

The collection includes:

#### 1. Health Check
- Method: GET
- URL: {{baseUrl}}/api/health
- Description: Verify the service is running

#### 2. **Bootstrap Rule Repository**
- **Method**: POST
- **URL**: `{{baseUrl}}/api/v1/bootstrap`
- **Headers**: 
  - Content-Type: application/json
  - Authorization: Bearer {{githubToken}}
- **Body**:
```json
{
  "ruleId": "021",
  "ruleVersion": "1.0.0",
  "organization": "psl-copilot"
}
```

#### 3. Populate Rule Repository
- Method: POST
- URL: `{{baseUrl}}/api/v1/populate`
- Headers: 
  - Content-Type: application/json
  - Authorization: Bearer {{githubToken}}
- **Body**:
```json
{
  "organization": "psl-copilot",
  "ruleId": "021",
  "ruleCode": "Ly8gU1BEWC1MaWNlbnNlLUlkZW50aWZpZXI6IEFwYWNoZS0yLjAKCmV4cG9ydCBjb25zdCBoZWxsbyA9ICgpID0+ICdIZWxsbyBXb3JsZCc7Cg==",
  "testCode": "aW1wb3J0IHsgaGVsbG8gfSBmcm9tICcuLi8uLi9zcmMvcnVsZS0wMjEnOwoKZGVzY3JpYmUoJ3J1bGUtMDIxJywgKCkgPT4gewogIHRlc3QoJ2hlbGxvJywgKCkgPT4gewogICAgZXhwZWN0KGhlbGxvKCkpLnRvQmUoJ0hlbGxvIFdvcmxkJyk7CiAgfSk7Cn0pOwo="
}
```

#### 4. Promote Rule Repository
- Method: POST
- URL: `{{baseUrl}}/api/v1/promote`
- Headers: 
  - Content-Type: application/json
  - Authorization: Bearer {{githubToken}}
- **Body**:
```json
{
  "organization": "psl-copilot",
  "ruleId": "021",
  "branchName": "dev"
}
```

#### 5. Delete a Repo (Utility)
- Method: DELETE
- URL: `https://api.github.com/repos/{{organization}}/rule-{{ruleId}}`
- Description: Direct GitHub API call to delete a repository (useful for cleanup)

### Environment Variables

The collection uses these variables (set in `local.postman_environment.json`):
- `baseUrl`: http://localhost:3000
- `githubToken`: Your GitHub Personal Access Token (set this manually)

### Quick Start with Postman

1. Set your GitHub token in the environment variables
2. Run the **Health Check** to verify the service is running
3. Run **Bootstrap** to create a new repository
4. Run **Populate** to add code to the repository
5. Run **Promote** to create a new branch

---

## Configuration

### Environment Variables

| Variable | Type | Required | Default | Description |
|----------|------|----------|---------|-------------|
| `PORT` | number | Yes | 3000 | Port number for the server |
| `NODE_ENV` | string | No | development | Environment mode (development/production/test) |
| `GITHUB_DEFAULT_BRANCH` | string | Yes | main | Default branch name for repositories |
| `GITHUB_TEMPLATE_REPO` | string | Yes | - | Name of the template repository |
| `GITHUB_TEMPLATE_OWNER` | string | Yes | - | Owner/organization of the template repository |
| `LOG_LEVEL` | string | No | info | Logging level (trace/debug/info/warn/error) |

### GitHub Token Permissions

Your GitHub Personal Access Token needs the following scopes:
- `repo` - Full control of private repositories
- `workflow` - Update GitHub Action workflows

To create a token:
1. Go to GitHub Settings → Developer settings → Personal access tokens → Tokens (classic)
2. Click "Generate new token"
3. Select the required scopes
4. Copy the token (you won't see it again!)

### Template Repository Requirements

Your template repository should contain:
- `package.json` (will be automatically updated)
- `src/rule.ts` (will be populated with rule code)
- `__tests__/unit/rule.test.ts` (will be populated with test code)
- Any other boilerplate files you want in every rule repository

---

## Development

### Available Scripts

```bash
# Development
npm run dev              # Start development server with hot reload

# Building
npm run build            # Compile TypeScript to JavaScript
npm run clean            # Remove dist, node_modules, coverage folders

# Testing
npm test                 # Run all tests
npm run test:watch       # Run tests in watch mode
npm run test:coverage    # Run tests with coverage report

# Code Quality
npm run lint             # Run ESLint and Prettier checks
npm run lint:eslint      # Run ESLint only
npm run lint:prettier    # Run Prettier check only
npm run fix:eslint       # Fix ESLint issues
npm run fix:prettier     # Fix Prettier issues

# Production
npm start                # Start production server
```

### Development Workflow

1. **Start the development server**
   ```bash
   npm run dev
   ```
   This uses nodemon to automatically restart the server when files change.

2. **Make your changes**
   Edit files in the `src/` directory.

3. **Test your changes**
   ```bash
   npm test
   ```

4. **Lint and format**
   ```bash
   npm run fix:eslint
   npm run fix:prettier
   ```

5. **Build for production**
   ```bash
   npm run build
   ```

### Code Structure Guidelines

- **Controllers**: Handle HTTP requests/responses (`src/app.controller.ts`)
- **Services**: Contain business logic (`src/services/*.ts`)
- **Schemas**: Define request/response types (`src/schemas/*.ts`)
- **Routes**: Define API endpoints (`src/router.ts`)
- **Config**: Environment configuration (`src/config.ts`)

---

## Testing

### Running Tests

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage
```

### Test Structure

Tests are located in `__tests__/unit/` and use Jest with TypeScript support.

Example test file (`__tests__/unit/github.logic.service.test.ts`):
```typescript
import { describe, expect, test } from '@jest/globals';
// Your tests here
```

### Coverage Reports

After running `npm run test:coverage`, view the report:
```
open coverage/lcov-report/index.html
```

### Testing Best Practices

- Write unit tests for all service functions
- Mock external API calls (GitHub API)
- Test error scenarios
- Aim for >80% code coverage
- Use descriptive test names

---

## Project Structure

```
Simulation-Sandbox/
├── __tests__/                    # Test files
│   └── unit/
│       └── github.logic.service.test.ts
│
├── postman/                      # Postman collection & environment
│   ├── Simulation Sandbox API.postman_collection.json
│   └── local.postman_environment.json
│
├── src/                          # Source code
│   ├── clients/                  # External client configurations
│   │   └── fastify.ts           # Fastify server setup
│   │
│   ├── interfaces/               # TypeScript interfaces
│   │   ├── github.interfaces.ts
│   │   └── index.ts
│   │
│   ├── schemas/                  # Request/response schemas
│   │   ├── bootstrapSchema.ts   # Bootstrap endpoint schema
│   │   ├── populateSchema.ts    # Populate endpoint schema
│   │   ├── promoteSchema.ts     # Promote endpoint schema
│   │   └── index.ts
│   │
│   ├── services/                 # Business logic
│   │   └── github.logic.service.ts  # GitHub API integration
│   │
│   ├── utils/                    # Utility functions
│   │   └── schema-utils.ts
│   │
│   ├── app.controller.ts         # HTTP controllers
│   ├── config.ts                 # Configuration management
│   ├── index.ts                  # Application entry point
│   └── router.ts                 # Route definitions
│
├── .env                          # Environment variables (not in repo)
├── .gitignore                    # Git ignore rules
├── docker-compose.yml            # Docker Compose configuration
├── Dockerfile                    # Docker image definition
├── eslint.config.mjs             # ESLint configuration
├── jest.config.ts                # Jest configuration
├── nodemon.json                  # Nodemon configuration
├── package.json                  # Dependencies and scripts
├── README.md                     # This file
└── tsconfig.json                 # TypeScript configuration
```

### Key Files Explained

- **`src/index.ts`**: Application entry point, starts the Fastify server
- **`src/router.ts`**: Defines all API routes and their handlers
- **`src/config.ts`**: Loads and validates environment variables
- **`src/services/github.logic.service.ts`**: Core business logic for GitHub operations
- **`src/clients/fastify.ts`**: Fastify server initialization with plugins
- **`docker-compose.yml`**: Docker orchestration for easy deployment
- **`jest.config.ts`**: Jest testing framework configuration
- **`tsconfig.json`**: TypeScript compiler options

---

## Security Considerations

### Best Practices

1. **Never commit your `.env` file**
   - The `.gitignore` file should include `.env`
   - Use environment-specific `.env` files

2. **Rotate GitHub tokens regularly**
   - Create tokens with minimum required permissions
   - Use short-lived tokens when possible

3. **Validate all inputs**
   - All endpoints use schema validation
   - Type checking with TypeScript

4. **Use HTTPS in production**
   - Enable SSL/TLS certificates
   - Use reverse proxy (nginx, Caddy)

5. **Rate limiting**
   - Consider adding rate limiting for production
   - Monitor GitHub API rate limits

6. **Error messages**
   - Don't expose sensitive information in errors
   - Log detailed errors server-side only

---

## Deployment

### Production Build

```bash
# Install dependencies
npm install --production

# Build the project
npm run build

# Start the server
npm start
```

### Docker Deployment

```bash
# Build the image
docker build -t simulation-sandbox:latest .

# Run the container
docker run -d \
  -p 3000:3000 \
  --env-file .env \
  --name simulation-sandbox \
  simulation-sandbox:latest
```

### Docker Compose

```bash
docker-compose up -d
```

### Environment Recommendations

| Environment | Configuration |
|-------------|---------------|
| **Development** | `NODE_ENV=development`, detailed logging, hot reload |
| **Staging** | `NODE_ENV=staging`, moderate logging, test data |
| **Production** | `NODE_ENV=production`, minimal logging, real data, HTTPS |

---

## Contributing

Contributions are welcome! Please follow these guidelines:

1. Fork the repository
2. Create a feature branch
   ```bash
   git checkout -b feature/amazing-feature
   ```
3. **Make your changes**
4. Run tests and linting
   ```bash
   npm test
   npm run lint
   ```
5. Commit your changes
   ```bash
   git commit -m 'Add amazing feature'
   ```
6. Push to the branch
   ```bash
   git push origin feature/amazing-feature
   ```
7. Open a Pull Request

### Coding Standards

- Follow existing code style
- Write tests for new features
- Update documentation
- Use meaningful commit messages
- Keep PRs focused and small

---

## License

This project is licensed under the MIT License.

```
MIT License

Copyright (c) 2026 Tazama

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

---

## Support

### Documentation

- Swagger UI: http://localhost:3000/docs (when running locally)
- GitHub API Docs: https://docs.github.com/en/rest

### Issues

If you encounter any issues or have questions:

1. Check the [existing issues](https://github.com/yourusername/Simulation-Sandbox/issues)
2. Create a new issue with:
   - Clear description of the problem
   - Steps to reproduce
   - Expected vs actual behavior
   - Environment details (OS, Node version, etc.)

---

## Acknowledgments

- Built with [Fastify](https://fastify.dev/) - Fast and low overhead web framework
- Schema validation by [TypeBox](https://github.com/sinclairzx81/typebox)
- Powered by [TypeScript](https://www.typescriptlang.org/)
- Part of the [Tazama FRMS](https://github.com/tazama-lf) ecosystem

---

## Status

![Build Status](https://img.shields.io/badge/build-passing-brightgreen)
![Coverage](https://img.shields.io/badge/coverage-85%25-green)
![License](https://img.shields.io/badge/license-MIT-blue)
![Node Version](https://img.shields.io/badge/node-%3E%3D18-brightgreen)
![TypeScript](https://img.shields.io/badge/TypeScript-5.9.3-blue)

---

Made by the Tazama Team

---

## Roadmap

### Future Enhancements

- [ ] Add GitHub Actions workflow templates
- [ ] Implement batch operations (bootstrap multiple repos)
- [ ] Add repository deletion endpoint with safety checks
- [ ] Support for multiple template repositories
- [ ] Webhook integration for automated deployments
- [ ] CLI tool for local development
- [ ] GraphQL API alternative
- [ ] Repository metrics and analytics
- [ ] Automated dependency updates
- [ ] Branch protection rule configuration

---

## FAQ

### Q: What GitHub permissions are required?
A: Your GitHub token needs `repo` scope for full repository access. If you're working with GitHub Actions, you also need the `workflow` scope.

### Q: Can I use this with GitHub Enterprise?
A: Yes! Just update the `api` URL in the service to point to your GitHub Enterprise instance (e.g., `https://github.yourcompany.com/api/v3`).

### Q: Why base64 encode the code?
A: Base64 encoding ensures that code with special characters, line breaks, and formatting is safely transmitted through JSON without corruption.

### Q: Can I create private repositories?
A: Yes! In the bootstrap endpoint, the template generation includes a `private: false` flag. You can modify this in the source code to create private repositories.

### Q: How do I handle GitHub API rate limits?
A: The service uses authenticated requests which have a limit of 5,000 requests per hour. Monitor the `X-RateLimit-Remaining` header in responses. Consider implementing caching or request queuing for high-volume use.

### Q: What happens if a repository already exists?
A: The bootstrap endpoint will return an error if the repository name already exists. Consider adding a unique suffix or using the delete endpoint first.

---

Star this repository if you find it useful!
