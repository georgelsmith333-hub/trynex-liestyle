---
name: Editable mockup source status
description: Distinguishes editable PSD/PSB provenance from runtime and visual release acceptance.
---

An approved Smart Mockup surface may report its editable master as verified only when the source path is present and points to the controlled master package. The runtime manifest validator must reject a verified surface without that provenance.

**Why:** The generated v10.3 package contains real editable masters, while the browser uses lightweight runtime role derivatives. Calling those masters manifest-only obscures the source-of-truth contract; treating source verification as equivalent to provider deployment or full visual acceptance would be unsafe.

**How to apply:** Keep editable masters outside public runtime paths, keep the six role derivatives and their matrix gate separate, and retain a distinct release/provider check for visual acceptance and edge deployment.