# API Documentation Setup Guide

This guide explains how to set up and view the Agent Memory System API documentation.

## Prerequisites

- Node.js 20+ and npm
- Python 3 (for alternative Python server)

## Method 1: Using npx (Simplest)

This method uses the `serve` package via npx - no installation required.

```bash
# From project root
cd docs

# Serve documentation on port 8080
npx serve . -p 8080
```

Then open your browser to:
- Swagger UI: http://localhost:8080/swagger-ui.html
- OpenAPI YAML: http://localhost:8080/openapi.yaml

## Method 2: Using Python HTTP Server

If you have Python installed:

```bash
# From project root
cd docs

# Python 3
python3 -m http.server 8080

# Or on Windows
py -m http.server 8080
```

Then open your browser to:
- Swagger UI: http://localhost:8080/swagger-ui.html
- OpenAPI YAML: http://localhost:8080/openapi.yaml

## Method 3: Using npm serve

First, install `serve` globally:

```bash
npm install -g serve
```

Then serve the documentation:

```bash
cd docs
serve . -p 8080
```

## Method 4: Integrate with Existing Server

To serve documentation from your existing Express server, add this route:

```typescript
import express from 'express';
import path from 'path';

const app = express();

// Serve API documentation
app.use('/docs', express.static(path.join(__dirname, '../docs')));

// Redirect root /docs to Swagger UI
app.get('/docs', (req, res) => {
  res.sendFile(path.join(__dirname, '../docs/swagger-ui.html'));
});

export { app };
```

Then access documentation at: `http://localhost:3000/docs`

## Method 5: Using Swagger UI Express

For a more integrated experience, install `swagger-ui-express`:

```bash
npm install --save-dev swagger-ui-express @types/swagger-ui-express
```

Then add to your server:

```typescript
import express from 'express';
import swaggerUi from 'swagger-ui-express';
import YAML from 'yamljs';
import path from 'path';

const app = express();

// Load OpenAPI spec
const openApiSpec = YAML.load(path.join(__dirname, '../docs/openapi.yaml'));

// Serve Swagger UI
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(openApiSpec, {
  customSiteTitle: 'Agent Memory System API',
  customCss: '.swagger-ui .topbar { display: none }',
  swaggerOptions: {
    persistAuthorization: true,
    displayRequestDuration: true,
    docExpansion: 'list',
    filter: true,
    tryItOutEnabled: true
  }
}));

// Serve raw OpenAPI spec
app.get('/openapi.yaml', (req, res) => {
  res.sendFile(path.join(__dirname, '../docs/openapi.yaml'));
});

export { app };
```

Then access:
- Swagger UI: http://localhost:3000/api-docs
- Raw spec: http://localhost:3000/openapi.yaml

## Using Postman Collection

1. Open Postman
2. Click Import
3. Select `docs/postman-collection.json`
4. The collection will be imported with:
   - All endpoints organized by category
   - Automatic authentication setup
   - Test scripts for token extraction
   - Pre-configured environment variables

### Using the Collection

1. Select the "Login" request
2. Update the username/password in the request body
3. Send the request
4. The test script will automatically save tokens to collection variables
5. Subsequent authenticated requests will use the saved token

## Verification

To verify your documentation setup:

```bash
# Check if files exist
ls -la docs/
# Expected output:
# openapi.yaml
# swagger-ui.html
# README.md
# postman-collection.json
# SETUP.md

# Validate OpenAPI spec (requires npx)
npx @apidevtools/swagger-cli validate docs/openapi.yaml
# Expected: No errors

# Start server
cd docs && npx serve . -p 8080

# In another terminal, test endpoints
curl http://localhost:8080/openapi.yaml
curl http://localhost:8080/swagger-ui.html
```

## Automated Documentation Updates

To automatically regenerate documentation when code changes:

### Using npm scripts

Add to `package.json`:

```json
{
  "scripts": {
    "docs:serve": "cd docs && npx serve . -p 8080",
    "docs:validate": "npx @apidevtools/swagger-cli validate docs/openapi.yaml"
  }
}
```

### Using file watchers

With `nodemon`:

```bash
npm install --save-dev nodemon

# Add to package.json
{
  "scripts": {
    "docs:watch": "nodemon --watch src/api --watch docs --exec 'npm run docs:generate'"
  }
}
```

## CI/CD Integration

### GitHub Actions

Create `.github/workflows/docs.yml`:

```yaml
name: Validate API Documentation

on:
  push:
    paths:
      - 'src/api/**'
      - 'docs/openapi.yaml'
  pull_request:
    paths:
      - 'src/api/**'
      - 'docs/openapi.yaml'

jobs:
  validate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
      - name: Validate OpenAPI spec
        run: npx @apidevtools/swagger-cli validate docs/openapi.yaml
```

## Troubleshooting

### CORS Issues

If you see CORS errors when accessing the API from Swagger UI:

1. Ensure your server has CORS enabled
2. Or use same-origin by serving docs from the same server

### Authentication Not Persisting

1. Check "Authorize" button in Swagger UI
2. Enter token in format: `Bearer YOUR_ACCESS_TOKEN`
3. Ensure `persistAuthorization: true` in Swagger config

### OpenAPI Validation Errors

```bash
# Detailed validation output
npx @apidevtools/swagger-cli validate docs/openapi.yaml --debug
```

Common issues:
- Invalid JSON/YAML syntax
- Missing required fields
- Invalid schema references
- Duplicate operation IDs

## Next Steps

- Customize `docs/README.md` for your specific use cases
- Add code examples in your programming language
- Set up automated documentation generation from TypeScript types
- Configure CI/CD to validate documentation on every commit

## Additional Resources

- [OpenAPI Specification](https://swagger.io/specification/)
- [Swagger UI Documentation](https://swagger.io/tools/swagger-ui/)
- [Postman Learning Center](https://learning.postman.com/)
