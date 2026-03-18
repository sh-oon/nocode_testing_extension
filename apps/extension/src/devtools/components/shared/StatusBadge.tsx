interface StatusBadgeProps {
  status: string;
}

export function StatusBadge({ status }: StatusBadgeProps) {
  const styles = status === 'passed'
    ? 'bg-green-100 text-green-700'
    : status === 'failed'
      ? 'bg-red-100 text-red-700'
      : 'bg-gray-100 text-gray-500';

  return (
    <span className={`px-1.5 py-0.5 text-[10px] font-medium rounded-full ${styles}`}>
      {status}
    </span>
  );
}
