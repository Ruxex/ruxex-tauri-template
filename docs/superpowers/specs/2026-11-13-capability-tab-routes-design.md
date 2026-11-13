# Give capability sections distinct routes and breadcrumbs

## Intent

Make Plugins, Skills, and MCP distinct navigable pages whose breadcrumb identifies the active section.

## Scope

- Add canonical routes `/capabilities/plugins`, `/capabilities/skills`, and `/capabilities/mcp`, reusing the existing capability content component.
- Point the capability sidebar items to those routes and derive the active item from the route.
- Show the matching section in the global breadcrumb; link plugin details back to the Plugins list.
- Use only the canonical section routes; do not retain a legacy query-tab route.

## Approaches

- Distinct section routes with the existing shared page component (chosen): gives each section a real URL without duplicating its shared data and interaction logic.
- Keep query tabs and only derive breadcrumbs from query values: does not separate the pages as requested.
- Split the large page into three independent React components: adds code movement and duplicated page setup without being required for route separation.

## Constraints and non-goals

Keep plugin detail URLs and capability content unchanged. No data or API changes. Do not add a redirect or query-tab fallback for `/capabilities`.
