import type { RawEvent } from '@like-cake/event-collector';

interface EventListProps {
  events: RawEvent[];
}

export function EventList({ events }: EventListProps) {
  if (events.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-gray-500 p-8">
        <div className="text-4xl mb-4">📡</div>
        <p className="text-center">
          No events captured yet.
          <br />
          Start recording to see raw events.
        </p>
      </div>
    );
  }

  return (
    <div className="divide-y divide-gray-800">
      {events.map((event, index) => (
        <EventItem
          key={event.id}
          event={event}
          index={index}
        />
      ))}
    </div>
  );
}

interface EventItemProps {
  event: RawEvent;
  index: number;
}

function EventItem({ event, index }: EventItemProps) {
  const time = new Date(event.timestamp).toLocaleTimeString();

  return (
    <div className="px-4 py-2 hover:bg-gray-800/50 transition-colors text-sm">
      <div className="flex items-center gap-2">
        <span className="text-gray-500 w-6">{index + 1}</span>
        <span className="font-mono text-xs text-gray-400">{time}</span>
        <span className={`px-2 py-0.5 rounded text-xs font-medium ${getEventColor(event.type)}`}>
          {event.type}
        </span>
        <span className="text-gray-400 truncate flex-1">{getEventSummary(event)}</span>
      </div>
    </div>
  );
}

function getEventColor(type: string): string {
  const colors: Record<string, string> = {
    click: 'bg-green-900 text-green-300',
    dblclick: 'bg-green-800 text-green-200',
    input: 'bg-purple-900 text-purple-300',
    change: 'bg-purple-800 text-purple-200',
    blur: 'bg-purple-700 text-purple-100',
    keydown: 'bg-yellow-900 text-yellow-300',
    keyup: 'bg-yellow-800 text-yellow-200',
    scroll: 'bg-cyan-900 text-cyan-300',
    navigation: 'bg-blue-900 text-blue-300',
  };

  return colors[type] || 'bg-gray-700 text-gray-300';
}

function getEventSummary(event: RawEvent): string {
  switch (event.type) {
    case 'click':
    case 'dblclick':
      return event.target.testId ? `[data-testid="${event.target.testId}"]` : event.target.tagName;
    case 'input':
    case 'change':
    case 'blur':
      return event.isSensitive
        ? `${event.target.tagName} (sensitive)`
        : `${event.target.tagName}: "${event.value.substring(0, 30)}${
            event.value.length > 30 ? '...' : ''
          }"`;
    case 'keydown':
    case 'keyup':
    case 'keypress':
      return event.key;
    case 'scroll':
      return `y: ${event.position.y}`;
    case 'navigation':
      return event.toUrl;
    default:
      return '';
  }
}
