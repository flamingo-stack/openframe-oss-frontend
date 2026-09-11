import { graphql } from 'react-relay';

export const registerPushDeviceMutation = graphql`
  mutation registerPushDeviceMutation($token: String!, $platform: PushPlatform!, $appVersion: String) {
    registerPushDevice(token: $token, platform: $platform, appVersion: $appVersion)
  }
`;
