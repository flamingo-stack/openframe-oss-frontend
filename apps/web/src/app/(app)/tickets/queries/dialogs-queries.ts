// Dialog and message commands. `dialogId` is the raw id (NATS subjects, routes,
// cache keys); `dialog` is null when the caller cannot read the dialog.
export const CREATE_DIALOG_MUTATION = `
  mutation CreateDialog($input: CreateDialogInput!) {
    createDialog(input: $input) {
      dialog { dialogId }
      userErrors { field message }
    }
  }
`;

export const UPDATE_DIALOG_MODE_MUTATION = `
  mutation UpdateDialogMode($input: UpdateDialogModeInput!) {
    updateDialogMode(input: $input) {
      userErrors { field message }
    }
  }
`;

export const STOP_DIALOG_GENERATION_MUTATION = `
  mutation StopDialogGeneration($input: StopDialogGenerationInput!) {
    stopDialogGeneration(input: $input) {
      userErrors { field message }
    }
  }
`;

export const SEND_MESSAGE_MUTATION = `
  mutation SendMessage($input: SendMessageInput!) {
    sendMessage(input: $input) {
      userErrors { field message }
    }
  }
`;

export const RESOLVE_APPROVAL_REQUEST_MUTATION = `
  mutation ResolveApprovalRequest($input: ResolveApprovalRequestInput!) {
    resolveApprovalRequest(input: $input) {
      userErrors { field message }
    }
  }
`;
