# Security Policy

## Supported versions

| Version | Supported |
|---|---|
| 0.1.x | Yes |

## Security properties of v0.1.0

- No remote code
- No network requests
- No host permissions
- No cookies, history, identity, downloads, clipboard-read, file-system or native-messaging permissions
- User-triggered `activeTab` access only
- Reads only the user's current text selection
- Local storage only
- No automatic message sending or web-page clicking

## Reporting a vulnerability

Do not post sensitive exploit details in a public issue. Before public release, replace this paragraph with a monitored security email. Acknowledge reports, reproduce the issue, publish a fix, increment the extension version, and document the security impact.

## Release safeguards

- Review every permission change
- Keep all executable code inside the extension package
- Pin dependencies; v0.1.0 intentionally has no runtime dependencies
- Run `python scripts/validate.py` before every release
- Inspect the generated ZIP and confirm `manifest.json` is at the archive root
- Publish source and release hash alongside the store package
