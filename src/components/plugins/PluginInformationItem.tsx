export function PluginInformationItem({
  href,
  label,
  value,
}: {
  href?: string;
  label: string;
  value: string;
}) {
  return (
    <div>
      <dt className="text-sm text-base-content/60">{label}</dt>
      <dd className="mt-1 break-words">
        {href ? (
          <a
            className="link link-primary"
            href={href}
            rel="noreferrer"
            target="_blank"
          >
            {value}
          </a>
        ) : (
          value
        )}
      </dd>
    </div>
  );
}
