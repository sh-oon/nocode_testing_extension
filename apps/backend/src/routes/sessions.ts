import { zValidator } from '@hono/zod-validator';
import type { RawEvent } from '@like-cake/event-collector';
import { Hono } from 'hono';
import { z } from 'zod';
import { sessionService } from '../services/session.service';
import type { ApiResponse } from '../types';

const sessions = new Hono();

// Validation schemas
const createSessionSchema = z.object({
  url: z.string().url(),
  name: z.string().optional(),
  viewport: z
    .object({
      width: z.number().int().positive(),
      height: z.number().int().positive(),
    })
    .optional(),
  userAgent: z.string().optional(),
});

const updateSessionSchema = z.object({
  name: z.string().optional(),
  status: z.enum(['recording', 'paused', 'stopped', 'completed']).optional(),
});

const paginationSchema = z.object({
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().max(100).optional(),
});

/**
 * List all sessions
 */
sessions.get('/', zValidator('query', paginationSchema), (c) => {
  const { page, limit } = c.req.valid('query');
  const result = sessionService.list({ page, limit });

  return c.json<ApiResponse<typeof result>>({
    success: true,
    data: result,
    meta: {
      total: result.total,
      page: result.page,
      limit: result.limit,
    },
  });
});

/**
 * Create a new session
 */
sessions.post('/', zValidator('json', createSessionSchema), (c) => {
  const input = c.req.valid('json');
  const session = sessionService.create(input);

  return c.json<ApiResponse<typeof session>>(
    {
      success: true,
      data: session,
    },
    201
  );
});

/**
 * Get session by ID
 */
sessions.get('/:id', (c) => {
  const id = c.req.param('id');
  const session = sessionService.getById(id);

  if (!session) {
    return c.json<ApiResponse<null>>(
      {
        success: false,
        error: 'Session not found',
      },
      404
    );
  }

  return c.json<ApiResponse<typeof session>>({
    success: true,
    data: session,
  });
});

/**
 * Get session with all events
 */
sessions.get('/:id/full', (c) => {
  const id = c.req.param('id');
  const session = sessionService.getWithEvents(id);

  if (!session) {
    return c.json<ApiResponse<null>>(
      {
        success: false,
        error: 'Session not found',
      },
      404
    );
  }

  return c.json<ApiResponse<typeof session>>({
    success: true,
    data: session,
  });
});

/**
 * Update session
 */
sessions.patch('/:id', zValidator('json', updateSessionSchema), (c) => {
  const id = c.req.param('id');
  const input = c.req.valid('json');
  const session = sessionService.update(id, input);

  if (!session) {
    return c.json<ApiResponse<null>>(
      {
        success: false,
        error: 'Session not found',
      },
      404
    );
  }

  return c.json<ApiResponse<typeof session>>({
    success: true,
    data: session,
  });
});

/**
 * Stop a recording session
 */
sessions.post('/:id/stop', (c) => {
  const id = c.req.param('id');
  const session = sessionService.stop(id);

  if (!session) {
    return c.json<ApiResponse<null>>(
      {
        success: false,
        error: 'Session not found',
      },
      404
    );
  }

  return c.json<ApiResponse<typeof session>>({
    success: true,
    data: session,
  });
});

/**
 * Delete session
 */
sessions.delete('/:id', (c) => {
  const id = c.req.param('id');
  const deleted = sessionService.delete(id);

  if (!deleted) {
    return c.json<ApiResponse<null>>(
      {
        success: false,
        error: 'Session not found',
      },
      404
    );
  }

  return c.json<ApiResponse<{ deleted: boolean }>>({
    success: true,
    data: { deleted: true },
  });
});

/**
 * Get events for a session
 */
sessions.get('/:id/events', (c) => {
  const id = c.req.param('id');
  const session = sessionService.getById(id);

  if (!session) {
    return c.json<ApiResponse<null>>(
      {
        success: false,
        error: 'Session not found',
      },
      404
    );
  }

  const events = sessionService.getEvents(id);

  return c.json<ApiResponse<typeof events>>({
    success: true,
    data: events,
    meta: {
      total: events.length,
    },
  });
});

/**
 * Add event to session
 */
sessions.post('/:id/events', async (c) => {
  const id = c.req.param('id');
  const session = sessionService.getById(id);

  if (!session) {
    return c.json<ApiResponse<null>>(
      {
        success: false,
        error: 'Session not found',
      },
      404
    );
  }

  if (session.status !== 'recording') {
    return c.json<ApiResponse<null>>(
      {
        success: false,
        error: 'Session is not recording',
      },
      400
    );
  }

  const event = (await c.req.json()) as RawEvent;
  const stored = sessionService.addEvent(id, event);

  return c.json<ApiResponse<typeof stored>>(
    {
      success: true,
      data: stored,
    },
    201
  );
});

/**
 * Add multiple events to session (batch)
 */
sessions.post('/:id/events/batch', async (c) => {
  const id = c.req.param('id');
  const session = sessionService.getById(id);

  if (!session) {
    return c.json<ApiResponse<null>>(
      {
        success: false,
        error: 'Session not found',
      },
      404
    );
  }

  const { events } = (await c.req.json()) as { events: RawEvent[] };
  const count = sessionService.addEvents(id, events);

  return c.json<ApiResponse<{ count: number }>>(
    {
      success: true,
      data: { count },
    },
    201
  );
});

/**
 * Clear events for a session
 */
sessions.delete('/:id/events', (c) => {
  const id = c.req.param('id');
  const session = sessionService.getById(id);

  if (!session) {
    return c.json<ApiResponse<null>>(
      {
        success: false,
        error: 'Session not found',
      },
      404
    );
  }

  const count = sessionService.clearEvents(id);

  return c.json<ApiResponse<{ cleared: number }>>({
    success: true,
    data: { cleared: count },
  });
});

export { sessions };
