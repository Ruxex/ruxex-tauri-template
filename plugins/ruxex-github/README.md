# Ruxex GitHub

This plugin provides the `requirements-planning` Skill. It helps an Agent inspect a selected repository, clarify a request, identify related Issues, and prepare a parent/child Issue draft set.

The Skill is read-only. It never writes to GitHub. Ruxex's desktop backend stages the Skill with the application and provides repository-scoped `gh` operations; the later GUI presents the drafts and requires explicit confirmation before creation.
