# How to Start a Remote Session

This tutorial shows a technician how to open a remote desktop session on a managed device from the Devices area of OpenFrame, and how to end that session when the work is done.

## Prerequisites

Before you start, confirm the following:

- You are signed in to OpenFrame and can open the **Devices** list.
- The device you want to connect to shows an **Online** (connected) status on the Devices list or on its Device Details page — an offline device cannot accept a remote session.
- The device has a MeshCentral agent registered against it. If the device has no MeshCentral agent, the remote session cannot be established and the page will report the agent as unavailable.
- Your organization's remote access policy for this device allows remote connections. If the policy is set to deny access, the entry points to start a session are disabled and you will see a "Remote access disabled" message instead of a session.
- If your organization requires end-user approval before a session starts, the device's user must be available to approve the request from their screen — a request that nobody answers will expire.

## Steps

1. Open the **Devices** page and locate the device you want to connect to.
2. Open the device's **Device Details** page by selecting the device from the list.
3. Choose the remote desktop option for that device to navigate to its Remote Desktop screen.
4. If your organization requires approval, wait on the **Waiting for approval** screen while the request is delivered to the device's user — the screen shows a countdown until the request expires, and you can select **Cancel Request** to stop waiting and leave the flow.
5. Once the connection is approved (or immediately, if your policy does not require approval), wait for the session to connect; the screen reports the connection state as the tunnel comes up.
6. Use the on-screen actions menu to adjust the session once connected: send keyboard shortcuts (for example `Ctrl+Alt+Del`, `Win+L`, `Win+R`), send power actions (Wake, Sleep, Reboot, Shut Down), or toggle input and clipboard sharing.
7. Open **Remote Settings** from the session screen if you need to change display quality, scaling, frame rate, scroll direction, mouse button mapping, or the remote keyboard map, then save — settings only apply while the connection state shows connected; saving while disconnected is rejected.
8. Use the fullscreen control on the session screen to expand the remote desktop view, and select it again to exit fullscreen.
9. When you are finished, end the session from the session screen's end-session control to disconnect from the device and leave the Remote Desktop screen.

## Expected result

- While waiting for approval, the screen shows the heading **Waiting for approval** with one of two messages: "The request is on the user's screen - waiting for their answer." (once delivered) or "Sending the request to `<device name or "this device">`..." (before delivery), plus an "Expires in `M:SS`" countdown.
- Once connected, the Remote Desktop screen renders the live device display inside the session canvas, with the actions menu and the fullscreen toolbar available.
- If the remote access policy denies access for the device, the screen shows **Remote access disabled** with the description "The remote access policy for this device does not allow remote connections." and a **Back to Device Details** button — no session starts.
- If the device's user declines the request, the screen shows **Remote access declined**, with the description reading either "The user declined your remote access request." or, when nobody answered and the policy's fallback denies access, "Nobody on `<device name>` could answer the request, and the remote access policy denies access in that case." Only a **Back to Device Details** button is offered; there is no retry from this screen.
- If nobody answers before the request expires, the screen shows **No response** with the description "Nobody answered the request on `<device name>` before it expired.", alongside **Back to Device Details** and **Retry** buttons.
- If another technician already has an active session or is awaiting approval on the same device, the screen shows **Device is busy** with a description naming the conflict, alongside **Back to Device Details** and **Retry**.
- If the request could not be delivered to the device at all, the screen shows **Couldn't reach the device** with the description "The request could not be delivered to `<device name>`. Nothing was sent, so it is safe to retry.", alongside **Back to Device Details** and **Retry**.
- After you end the session, the live view stops and you leave the active session state.

## Troubleshooting

- **"Remote access disabled" / "The remote access policy for this device does not allow remote connections."** — The device's remote access policy is set to deny access. There is no retry; use **Back to Device Details** and check the policy configuration for that device or organization.
- **"Remote access declined" / "The user declined your remote access request."** — The device's user actively declined the request. Go back and start a new request if you need to try again later.
- **"Remote access declined" / "Nobody on `<device>` could answer the request, and the remote access policy denies access in that case."** — No one was available to approve, and the fallback behavior for unanswered requests is set to deny. Confirm someone is at the device before retrying.
- **"No response" / "Nobody answered the request on `<device>` before it expired."** — The approval request timed out. Select **Retry** to send a new request once the user is available.
- **"Device is busy"** — Either another technician has an active remote session on the device, or another technician's request is already awaiting approval. Wait for that session or request to end, then select **Retry**.
- **"Couldn't reach the device"** — The request never reached the device. Nothing was sent, so it is safe to select **Retry**.
- **"Agent not available" (on the remote shell/session screens)** — The device has no MeshCentral agent ID available; a remote session cannot be opened for it. The material does not show a remediation step for this beyond confirming the agent is installed and connected.
- **Settings save rejected in the Remote Settings dialog** — Settings can only be saved while the session is fully connected; if the connection drops before you save, reconnect first and try again.

