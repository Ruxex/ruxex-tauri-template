export function SidebarHeader({
  label,
}: {
  label: string;
  onClose?: () => void;
}) {
  return <h2 className="mb-5 truncate text-lg font-semibold">{label}</h2>;
}
