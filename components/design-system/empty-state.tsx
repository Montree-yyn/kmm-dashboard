type EmptyStateProps = { message?: string };

export function EmptyState({ message = "No data available for the selected filters." }: EmptyStateProps) {
  return <p className="grid min-h-32 place-items-center text-center text-sm font-medium text-[#9CA3AF]">{message}</p>;
}
