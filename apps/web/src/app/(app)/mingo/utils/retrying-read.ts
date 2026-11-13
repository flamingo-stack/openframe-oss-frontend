import { SessionGoneError } from '@/lib/session-health';
import { sessionPollsAllowed } from '@/lib/session-poll';
import { UpdateRequiredError } from '@/lib/version-check';

/** Tries after the first, and the wait before the first of them (doubled each time): 1 s, 2 s, 4 s. */
const READ_RETRIES = 3;
const READ_RETRY_BASE_MS = 1000;

/**
 * A read that tries again after a failure, as the chat's queries did under react-query: one 502 while the ai-agent rolls
 * over must not leave a chat that opened empty. Never a command, never past a paused session or a bundle the gateway
 * refuses (`UpdateRequiredError`, `SessionGoneError`): those answers will not change on their own.
 */
export function retryingRead<A extends unknown[], R>(read: (...args: A) => Promise<R>): (...args: A) => Promise<R> {
  return async (...args: A) => {
    for (let attempt = 0; ; attempt += 1) {
      try {
        return await read(...args);
      } catch (error) {
        const final =
          attempt >= READ_RETRIES ||
          error instanceof UpdateRequiredError ||
          error instanceof SessionGoneError ||
          !sessionPollsAllowed();
        if (final) throw error;
        await new Promise(resolve => {
          setTimeout(resolve, READ_RETRY_BASE_MS * 2 ** attempt);
        });
      }
    }
  };
}
