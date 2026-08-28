# PDF Generation

STATUS: IMPLEMENTED (PHASE 4)

The MANAK platform generates dynamic PDFs for Handbooks and Reports using `pdfkit`.

## PDF Library
- **Library**: `pdfkit`
- **Reasoning**: A lightweight, pure-JavaScript library that avoids the heavy overhead of installing a browser engine (e.g., Puppeteer).

## Endpoints
- `GET /handbooks/:id/pdf` - Generates a PDF for a handbook.
- `GET /reports/:id/pdf` - Generates a PDF for a report.

## Authorization
- Authorization is checked server-side via `domainService.getPdfForHandbook` and `domainService.getPdfForReport`.
- Handbooks require the user to be a member of the organization associated with the handbook's parent document.
- Reports require the user to be the owner of the report or a member of the organization associated with the report.
- Unauthorized access returns a `403 FORBIDDEN` or `404 RESOURCE_NOT_FOUND` depending on data visibility, without leaking private resource existence.

## Supported Data
- **Handbooks**: Title, Category, Status, Generated Date, Description, and Metadata details.
- **Reports**: Title, Report Type, Status, Generated Date, Report Summary, and Metadata details.
- Real database content is queried and rendered natively in the PDF.

## Unicode Behavior
- **Limitation**: Currently uses standard PDFKit Helvetica/Helvetica-Bold fonts which are strictly limited to Latin-1/ASCII characters.
- Hindi or complex Indian language Unicode characters are **NOT SUPPORTED** natively by the standard fonts used. If Unicode is strictly required in the future, a TTF font (e.g., Noto Sans Devanagari) must be bundled and registered with `doc.font('/path/to/font.ttf')`.

## Frontend Download Behavior
- Downloads are executed via fetch with `Authorization` headers.
- Response is retrieved as a `Blob` which triggers a secure browser download via an injected `<a>` tag utilizing `URL.createObjectURL(blob)`.
- Handles multiple states properly: Loading, Success, Error. Duplicate downloads are prevented while loading.
