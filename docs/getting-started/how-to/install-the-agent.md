# How to Install the OpenFrame Agent on a Device

This tutorial shows an OpenFrame operator how to install the OpenFrame agent on a single device from the **New Device** screen and confirm that the device reports in.

## Prerequisites

- You can sign in to the OpenFrame web console and reach the **Devices** area.
- You have at least one Customer (organization) already set up in OpenFrame, since every new device must be assigned to one.
- The device you are installing on has network access to the OpenFrame server, and you can run commands on it (a terminal on macOS/Linux, or PowerShell on Windows).
- You know which operating system the target device runs (Windows, macOS, or Linux), since the install command is generated per platform.
- Your OpenFrame user account has an active registration secret available — the **New Device** screen loads this automatically, but if it fails to load you will see a "Failed to load registration secret" notification and need to retry before continuing.

## Steps

1. Open the OpenFrame web console and navigate to the **Devices** section, then choose **New Device** (or **Add Device**) to open the New Device page.
2. In the **Select Customer** field, choose the customer organization the device belongs to. If you arrived from a customer's own page, this field is pre-filled with that customer already.
3. In the **Select Platform** field, choose the operating system of the target device (for example Windows, macOS, or Linux).
4. In the **Install Method** field, choose how you want to install the agent. The default is the install script; on Windows this list can also include Winget or Chocolatey, and on macOS it can include Homebrew, depending on what the platform supports.
5. Optionally, use **Add Device Tag** to attach one or more key/value tags to the device before installing (tag keys and values may only contain letters, numbers, underscores, hyphens and dots, and each key must be unique).
6. Review the command shown in the **OpenFrame Installation Script** box (or, if you selected a package-manager install method, the **OpenFrame Register Command** box shown alongside the install command for that package manager).
7. Select **Copy Install Command** (labeled **Copy Install & Register Command** when a package-manager method is selected) to copy the generated command to your clipboard.
8. Open a terminal (or PowerShell, on Windows) on the target device and paste the copied command, then run it.
9. Wait for the command to finish running on the device, then return to the OpenFrame console's **Devices** list and confirm the new device now appears there as reporting in.

The material does not show a confirmation dialog or progress indicator inside the console itself while the agent installs on the device — status is confirmed by checking the **Devices** list afterward.

## Expected result

- The install command box shows a generated command that embeds the server URL, your registration secret, the release version, the organization ID, and any tags you added — this is what you copy and run on the device.
- Selecting **Copy Install Command** shows a success confirmation ("Command copied to clipboard") and the button's icon changes to a checkmark while copied.
- After running the command on the device, the device should appear in the **Devices** list for the customer organization you selected in step 2.

## Troubleshooting

- **"Failed to load registration secret"** — this toast notification appears if the active registration secret could not be fetched when the New Device page loaded. Reload the New Device page and try again before copying the install command.
- **"Secret unavailable" / "Registration secret not loaded yet"** — shown if you try to copy or run the command before the registration secret has finished loading. Wait a moment for the page to finish loading, then retry.
- **"Validation error" / "Please select a customer"** — shown if you try to copy the command without choosing a value in **Select Customer**. Choose a customer and try again.
- **"Invalid tags"** — shown if a tag key or value contains characters other than letters, numbers, underscores, hyphens, or dots. Fix the tag and try again.
- **"Duplicate tags"** — shown if you added the same tag key more than once. Remove the duplicate and try again.
- If the device still does not appear in the **Devices** list after running the install command, the material does not document further diagnostic steps here; confirm the device has network access to the OpenFrame server and that the install command ran without error in the terminal.
