interface ConnectionDotProps {
  connected: boolean;
}

export function ConnectionDot({ connected }: ConnectionDotProps) {
  return (
    <div className="flex items-center gap-1.5">
      <span className={`w-1.5 h-1.5 rounded-full ${connected ? 'bg-green-500' : 'bg-gray-300'}`} />
      <span className={`text-[10px] ${connected ? 'text-green-600' : 'text-gray-400'}`}>
        {connected ? 'Connected' : 'Offline'}
      </span>
    </div>
  );
}
