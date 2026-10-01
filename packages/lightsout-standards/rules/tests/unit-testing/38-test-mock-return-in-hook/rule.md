---
summary: "Where a mock's return value is set."
checked: true
severity: advisory
---

## Test Mock Return in Hook

Set a mock's return value or implementation (`mockReturnValue`, `mockResolvedValue`, `mockRejectedValue`, `mockImplementation`) in the setup factory, never in a `beforeEach`, so each test states its own arrangement.
