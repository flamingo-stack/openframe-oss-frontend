import { graphql, readInlineData } from 'react-relay';
import type { userPhone_account$key } from '@/__generated__/userPhone_account.graphql';

// The one number the user page and Edit User call the user's Phone, read from the three the wire carries.
const userPhoneFragment = graphql`
  fragment userPhone_account on DirectoryAccount @inline {
    phone
    details {
      mobilePhone
      businessPhones
    }
  }
`;

/** Where the Phone field saves: one field in Figma, three on the wire. It goes back where it was read from. */
export type PhoneTarget = 'mobile' | 'business' | 'local';

export interface UserPhone {
  /** `''` when there is none. */
  phone: string;
  target: PhoneTarget;
  /** A Google user's other business numbers: the field shows one, the write sends the whole list. */
  otherBusinessPhones: readonly string[];
}

/**
 * The mobile number, then the first business one, then the stored local one; an empty string is no number. A failed
 * live read leaves only the local one, and a provider account that has none starts a business one.
 */
export function readUserPhone(ref: userPhone_account$key): UserPhone {
  const { phone, details } = readInlineData(userPhoneFragment, ref);
  if (details?.mobilePhone) return { phone: details.mobilePhone, target: 'mobile', otherBusinessPhones: [] };
  const [business, ...others] = details?.businessPhones ?? [];
  if (business) return { phone: business, target: 'business', otherBusinessPhones: others };
  if (phone || !details) return { phone: phone ?? '', target: 'local', otherBusinessPhones: [] };
  return { phone: '', target: 'business', otherBusinessPhones: [] };
}
