---
name: PSD/PSB master ingestion
description: Server-side validation contract for editable Photoshop masters and approved browser runtime roles.
---

Editable PSD/PSB masters must be uploaded to private `/objects/...` storage and parsed from the stored bytes on the API server. The server owns the actual format, MIME, dimensions, checksum, Smart Object layer, and placement metadata; the browser may only provide the selected source identity and approved six-role runtime manifest.

**Why:** client-generated checksums, generic Smart Object names, public master URLs, or preview-only readiness let an unreviewed or mismatched editable source enter the runtime contract.

**How to apply:** keep editable masters out of `public/`, persist server-derived file metadata and the normalized ingestion manifest, render customer previews from the accepted six PNG roles, and fail closed on missing/mismatched source identity or parser errors.