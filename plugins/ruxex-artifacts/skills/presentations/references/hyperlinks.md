# Hyperlinks

Supported rich-text runs and images can carry external hyperlinks. Text can
also link to another slide using an internal slide-jump URI. Preserve the
source URL and link intent when importing a deck; other PowerPoint action types
are not reconstructed.

    shape.text = [[
      { run: "Open source", link: { uri: "https://example.org/report", isExternal: true } },
      { run: "Next slide", link: { uri: "slide:2", isExternal: false, action: "ppaction://hlinksldjump" } },
    ]];

Use a descriptive link label. Do not display a raw URL when clear link text
will tell the audience where it goes.
