import type { Response } from "express";

const notificationStreams = new Map<string, Set<Response>>();

export function subscribeToNotifications(userId: string, response: Response): () => void {
  const streams = notificationStreams.get(userId) ?? new Set<Response>();
  streams.add(response);
  notificationStreams.set(userId, streams);
  return () => {
    streams.delete(response);
    if (streams.size === 0) notificationStreams.delete(userId);
  };
}

export function publishNotification(userId: string, notification: unknown): void {
  const streams = notificationStreams.get(userId);
  if (!streams) return;
  const message = `data: ${JSON.stringify(notification)}\n\n`;
  for (const response of streams) {
    if (response.writableEnded || response.destroyed) {
      streams.delete(response);
      continue;
    }
    response.write(message);
  }
  if (streams.size === 0) notificationStreams.delete(userId);
}
