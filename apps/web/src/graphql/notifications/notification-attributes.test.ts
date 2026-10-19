/**
 * The Remote Sessions recording family as the routing reads it: three cards about one
 * recording, two about the tenant's storage, and the failed session that is neither.
 */
import { describe, expect, it } from 'vitest';
import {
  isRecordingNotificationType,
  isRecordingStorageNotificationType,
  NEW_PERMISSIONS_REQUIRED_TYPE,
  NOTIFICATION_ATTR,
  RECORDING_NOTIFICATION_TYPES,
  readNotificationAttributes,
} from './notification-attributes';

describe('the recording notification family', () => {
  it('tells the cards about one recording from the storage ones', () => {
    const { expiresIn7Days, aboutToBeDeleted, keepReleasedBySomeoneElse, failed, storageNearlyFull, storageFull } =
      RECORDING_NOTIFICATION_TYPES;
    expect([expiresIn7Days, aboutToBeDeleted, keepReleasedBySomeoneElse].every(isRecordingNotificationType)).toBe(true);
    expect([storageNearlyFull, storageFull].every(isRecordingStorageNotificationType)).toBe(true);
    // A failed session left no recording and names no storage.
    expect(isRecordingNotificationType(failed)).toBe(false);
    expect(isRecordingStorageNotificationType(failed)).toBe(false);
  });

  it('is not fooled by another family or a non-string', () => {
    expect(isRecordingNotificationType(NEW_PERMISSIONS_REQUIRED_TYPE)).toBe(false);
    expect(isRecordingStorageNotificationType('TICKET_ASSIGNED')).toBe(false);
    expect(isRecordingNotificationType(undefined)).toBe(false);
  });

  it('reads the recording and device ids out of the attributes', () => {
    const attributes = readNotificationAttributes({ recordingId: 'rec-1', deviceId: 'machine-1', sessionId: '' });
    expect(attributes[NOTIFICATION_ATTR.recordingId]).toBe('rec-1');
    expect(attributes[NOTIFICATION_ATTR.deviceId]).toBe('machine-1');
    expect(attributes).not.toHaveProperty('sessionId');
  });
});
