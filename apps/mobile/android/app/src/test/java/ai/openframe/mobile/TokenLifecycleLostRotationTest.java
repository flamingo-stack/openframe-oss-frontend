package ai.openframe.mobile;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertTrue;

import org.junit.Test;

/**
 * The lost-rotation timing rules (CU-17tkuw64r3v). After a refresh whose
 * answer was lost, the shell holds callers back and re-presents the same
 * refresh token on its own, inside the window in which the auth server still
 * honours a rotated-away token. Get these wrong and a lost answer signs the
 * user out, or a failing refresh is re-posted without end. Also what an answer
 * settles as, and which outcomes hold callers back (CU-17tkuw65dnm).
 */
public class TokenLifecycleLostRotationTest {

    /** How long the auth server honours a rotated-away refresh token ({@code openframe.authz.refresh-token-grace-seconds}). */
    private static final long SERVER_GRACE_MS = 60_000;
    /** How long the gateway waits on the auth server ({@code WebClientConfig}'s {@code responseTimeout}). */
    private static final long GATEWAY_AUTH_WAIT_MS = 30_000;
    /** The shell gives up on a refresh POST after this; the loss settles then. */
    private static final long WALL_CLOCK_BUDGET_MS = 10_000;

    private static final long SENT = 1_000_000;

    @Test
    public void holdEndsOnlyOnceTheGatewayHasStoppedServingTheLostPost() {
        assertTrue(TokenLifecycle.lostRotationHoldEnd(SENT) - SENT > GATEWAY_AUTH_WAIT_MS);
    }

    @Test
    public void aCallersLostPostIsRePresentedInsideTheServerGrace() {
        long deadline = TokenLifecycle.lostRotationRetryDeadline(SENT, false, null);
        long holdEnd = TokenLifecycle.lostRotationHoldEnd(SENT);
        long settledAt = SENT + WALL_CLOCK_BUDGET_MS;
        long firesAt = settledAt + TokenLifecycle.lostRotationRetryDelay(holdEnd, settledAt);

        assertTrue(TokenLifecycle.mayRetryLostRotation(holdEnd, deadline));
        assertTrue("the hold must not refuse the shell's own retry", firesAt > holdEnd);
        // The rotation came after the send, so the grace runs at least until SENT + SERVER_GRACE_MS.
        assertTrue(firesAt < SENT + SERVER_GRACE_MS);
    }

    @Test
    public void theRetryWindowClosesBeforeTheServerGraceDoes() {
        long deadline = TokenLifecycle.lostRotationRetryDeadline(SENT, false, null);

        assertTrue(deadline - SENT < SERVER_GRACE_MS);
    }

    @Test
    public void aLossOnTheShellsOwnRetryKeepsItsWindowSoTheShellStops() {
        long firstDeadline = TokenLifecycle.lostRotationRetryDeadline(SENT, false, null);
        long retrySent = TokenLifecycle.lostRotationHoldEnd(SENT) + TokenLifecycle.lostRotationRetryDelay(0, 0);

        long kept = TokenLifecycle.lostRotationRetryDeadline(retrySent, true, firstDeadline);

        assertEquals(firstDeadline, kept);
        assertFalse(TokenLifecycle.mayRetryLostRotation(TokenLifecycle.lostRotationHoldEnd(retrySent), kept));
    }

    @Test
    public void aLaterCallersLostPostAfterACappedDoubtGetsItsOwnWindow() {
        long staleDeadline = TokenLifecycle.lostRotationRetryDeadline(SENT, false, null);
        long callerSent = SENT + 10 * 60_000;

        long fresh = TokenLifecycle.lostRotationRetryDeadline(callerSent, false, staleDeadline);

        assertEquals(TokenLifecycle.lostRotationRetryDeadline(callerSent, false, null), fresh);
        assertTrue(TokenLifecycle.mayRetryLostRotation(TokenLifecycle.lostRotationHoldEnd(callerSent), fresh));
    }

    @Test
    public void anOwnRetryWithNoWindowLeftToKeepStartsOne() {
        assertEquals(
            TokenLifecycle.lostRotationRetryDeadline(SENT, false, null),
            TokenLifecycle.lostRotationRetryDeadline(SENT, true, null));
    }

    @Test
    public void aRetryMayStartUpToTheDeadlineButNotAtIt() {
        long deadline = TokenLifecycle.lostRotationRetryDeadline(SENT, false, null);

        assertTrue(TokenLifecycle.mayRetryLostRotation(deadline - 1, deadline));
        assertFalse(TokenLifecycle.mayRetryLostRotation(deadline, deadline));
        assertFalse("no window, no retry", TokenLifecycle.mayRetryLostRotation(SENT, null));
    }

    @Test
    public void theTimerNeverFiresBeforeItsMomentAndAMissedMomentFiresAtOnce() {
        long ahead = 5_000;

        assertTrue(TokenLifecycle.lostRotationRetryDelay(SENT + ahead, SENT) > ahead);
        assertEquals(TokenLifecycle.lostRotationRetryDelay(SENT, SENT), TokenLifecycle.lostRotationRetryDelay(SENT - ahead, SENT));
    }

    @Test
    public void onlyARePresentationThatNeverLeftTheDeviceIsTriedAgain() {
        TokenLifecycle.RefreshResult unreached = TokenLifecycle.RefreshResult.failed(TokenLifecycle.Code.UNREACHED, "no network path");

        assertTrue(TokenLifecycle.rearmsLostRotationRetry(unreached, true));
        assertFalse("the doubt was cleared meanwhile", TokenLifecycle.rearmsLostRotationRetry(unreached, false));
        assertFalse(TokenLifecycle.rearmsLostRotationRetry(failed(TokenLifecycle.Code.UNKNOWN), true));
        assertFalse(TokenLifecycle.rearmsLostRotationRetry(failed(TokenLifecycle.Code.ANSWERED_ERROR), true));
        assertFalse(TokenLifecycle.rearmsLostRotationRetry(failed(TokenLifecycle.Code.HELD), true));
        assertFalse(TokenLifecycle.rearmsLostRotationRetry(failed(TokenLifecycle.Code.NO_HOST), true));
        assertFalse(TokenLifecycle.rearmsLostRotationRetry(TokenLifecycle.RefreshResult.tokens(new TokenPair("access", "refresh")), true));
        assertFalse(TokenLifecycle.rearmsLostRotationRetry(TokenLifecycle.RefreshResult.sessionOver(), true));
    }

    /**
     * An error the gateway answered with is not an answer that went missing:
     * 502 and 503 are how it reports an auth server it could not use. Classed
     * as unknown, one held every caller back, the Retry on the web view's
     * "can't verify your session" screen included.
     */
    @Test
    public void anAnsweredErrorIsNotALostAnswer() {
        for (int status : new int[] {502, 503, 500, 429, 403, 404}) {
            TokenLifecycle.Outcome outcome = TokenLifecycle.outcomeOfAnswerWithoutTokens(status, SENT);

            assertEquals("HTTP " + status, TokenLifecycle.Outcome.Kind.ANSWERED_ERROR, outcome.kind);
            assertEquals("the shell still re-presents it, from its send", SENT, outcome.sentAt);
            assertFalse("HTTP " + status + " would hold callers back", TokenLifecycle.holdsCallers(outcome.kind));
        }
        assertEquals(TokenLifecycle.Outcome.Kind.REJECTED, TokenLifecycle.outcomeOfAnswerWithoutTokens(401, SENT).kind);
    }

    @Test
    public void aSuccessWithoutTokensRotatedAndHoldsCallersLikeALostAnswer() {
        TokenLifecycle.Outcome outcome = TokenLifecycle.outcomeOfAnswerWithoutTokens(204, SENT);

        assertEquals(TokenLifecycle.Outcome.Kind.UNKNOWN, outcome.kind);
        assertEquals(SENT, outcome.sentAt);
        assertTrue(TokenLifecycle.holdsCallers(outcome.kind));
    }

    private static TokenLifecycle.RefreshResult failed(String code) {
        return TokenLifecycle.RefreshResult.failed(code, code);
    }
}
