/**
 * A starting point for workspace admins writing their own template. It shows
 * every value and helper that is available, a running header and footer with
 * page numbers, and a table of contents.
 */
export const exampleTemplate = `<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>{{title}}</title>

    {{!-- Outline's editor styles, remove this line to style content yourself --}}
    {{{styles}}}

    <style>
      /* Page size and margins, the margins leave room for header and footer */
      @page {
        size: A4;
        margin: 28mm 20mm 24mm 20mm;
      }

      html, body {
        background: #fff;
      }

      body {
        font-family: "Helvetica Neue", Helvetica, Arial, sans-serif;
        color: #1f2328;
      }

      .cover {
        border-bottom: 3px solid #0366d6;
        padding-bottom: 12px;
        margin-bottom: 24px;
      }

      .cover .team {
        text-transform: uppercase;
        letter-spacing: 0.08em;
        font-size: 10pt;
        color: #0366d6;
      }

      .cover h1 {
        font-size: 26pt;
        margin: 8px 0 12px;
      }

      .meta {
        border-collapse: collapse;
        font-size: 9pt;
        color: #555;
      }

      .meta th {
        text-align: left;
        font-weight: 600;
        padding: 2px 16px 2px 0;
      }

      .toc {
        page-break-after: always;
        font-size: 10pt;
      }

      .toc li.level-2 { margin-left: 16px; }
      .toc li.level-3 { margin-left: 32px; }
      .toc li.level-4 { margin-left: 48px; }

      /* Avoid breaking pages inside these elements */
      img, table, pre, blockquote {
        break-inside: avoid;
      }
    </style>
  </head>
  <body>
    {{!--
      The elements with the ids "pdf-header" and "pdf-footer" are repeated on
      every page. They are rendered separately, so styles must be inline and the
      font size must be set explicitly. The classes pageNumber, totalPages,
      date and title are filled in by the PDF renderer.
    --}}
    <template id="pdf-header">
      <div style="font-size: 8pt; color: #777; width: 100%; padding: 0 20mm; display: flex; justify-content: space-between;">
        <span>{{team.name}}</span>
        <span>{{title}}</span>
      </div>
    </template>

    <template id="pdf-footer">
      <div style="font-size: 8pt; color: #777; width: 100%; padding: 0 20mm; display: flex; justify-content: space-between;">
        <span>Exported {{formatDate exportedAt "PPP"}}</span>
        <span>Page <span class="pageNumber"></span> of <span class="totalPages"></span></span>
      </div>
    </template>

    <section class="cover">
      <div class="team">{{team.name}}</div>
      <h1>{{#if icon}}{{icon}} {{/if}}{{title}}</h1>
      <table class="meta">
        {{#if collection}}
          <tr><th>Collection</th><td>{{collection.name}}</td></tr>
        {{/if}}
        <tr><th>Author</th><td>{{default createdBy.name "Unknown"}}</td></tr>
        <tr><th>Last updated</th><td>{{formatDate updatedAt "PPP"}} by {{default updatedBy.name "Unknown"}}</td></tr>
        <tr><th>Exported by</th><td>{{exportedBy.name}}</td></tr>
        <tr><th>Source</th><td>{{url}}</td></tr>
      </table>
    </section>

    {{#if headings.length}}
      <nav class="toc">
        <h2>Contents</h2>
        <ul>
          {{#each headings}}
            <li class="level-{{level}}">{{title}}</li>
          {{/each}}
        </ul>
      </nav>
    {{/if}}

    <main>
      {{{content}}}
    </main>
  </body>
</html>
`;
