/**
 * Renders citation strings of the form "Label: https://url" as a list with the
 * URL turned into a clickable link. Strings without a URL render as plain text.
 */
export function SourceList({ sources }: { sources: string[] }) {
  return (
    <ul className="mt-2 space-y-1.5 text-sm text-bamboo-700">
      {sources.map((s, i) => {
        const m = s.match(/^(.*?):\s*(https?:\/\/\S+)$/);
        if (!m) return <li key={i} className="list-inside list-disc">{s}</li>;
        const [, label, url] = m;
        return (
          <li key={i}>
            <a
              href={url}
              target="_blank"
              rel="noreferrer"
              className="text-leaf-700 underline decoration-bamboo-300 underline-offset-2 hover:decoration-leaf-500"
            >
              {label}
            </a>
          </li>
        );
      })}
    </ul>
  );
}
