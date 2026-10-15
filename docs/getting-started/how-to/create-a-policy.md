
# How to Create a Policy

A technician or admin creates a compliance policy — an osquery check that devices either pass or fail — and assigns it to specific devices so OpenFrame can monitor those devices for compliance.

## Prerequisites

- You are signed in to OpenFrame and can reach the **Monitoring** section of the app.
- At least one device has an agent installed and is reporting as online or offline (not simply missing) — devices without a connected agent cannot be assigned a policy. On the **Devices** tab for a specific device, the inline message "Fleet agent is not installed" appears next to devices that cannot be selected.
- You know the osquery SQL query the policy should run, and whether the devices you want to target already appear in your device list.
- You have permission to create and edit policies in your tenant (ask your administrator if the **Add Policy** button is not visible).

## Steps

1. Open the **Monitoring** section and switch to the **Policies** tab.
2. Click **Add Policy** (shown as the primary accent button when the policies list is empty, or as an outline button in the page header otherwise).
3. On the **New Policy** page, type a name into the **Name** field (labeled "Enter Policy Name"). This is required — the **Save Policy** button stays disabled until a name is entered.
4. Optionally type a description into the **Description** field (labeled "Enter Policy Description").
5. Enter the compliance check's SQL under the **Query** label, using the SQL code editor. This is the osquery query that determines whether a device passes or fails the policy.
6. Under the **Devices** heading, use the device selector to choose which devices this policy applies to. Devices showing "Fleet agent is not installed" cannot be selected.
7. Optionally click **Test Policy** to open the live test panel and run the query against selected devices before saving, to confirm it returns the expected results.
8. Click **Save Policy** to create the policy and assign it to the selected devices.

## Expected result

After saving, you are returned to the **Policies** tab, where the new policy appears in the policies table with its **Name**, **Severity** (Critical or Low), and compliance **Status** (Compliant, Failing, or Pending) columns populated. On a device's own detail page, open its **Policies** tab to confirm the policy now appears there with the same pass/fail/pending mapping.

If this is the first policy created in the tenant, the **Policies** tab previously showed the message "No policies yet" with the description "Rules that automatically enforce settings, configurations, and security standards across devices will be displayed here." — after saving, that empty state is replaced by the policies table.

## Troubleshooting

- **"No policies yet"** keeps showing after you believe you saved a policy: this message only appears when the policies list is genuinely empty and no search is active — confirm the save succeeded (watch for a success toast after clicking **Save Policy**) and that no search filter is hiding the result.
- **A device cannot be selected in the Devices list, showing "Fleet agent is not installed"**: the policy cannot be assigned to that device until its agent is installed and connected to Fleet. The material does not show the steps to install the agent on a device from this screen.
- **"Couldn't load policies."**: shown above the policies table when the list fails to load or the connection is offline. Use the retry action in that message, or check your network connection.
- **A policy you expect to see on a device's Policies tab is missing**: that tab only shows "No policies applied" or "No policies yet" when the device genuinely has none assigned — verify the device was included in the **Devices** selection when the policy was saved.
- **Deleting a policy**: from the policies table, open a policy's row actions and choose **Delete Policy**; a confirmation dialog appears before the policy and its device assignments are removed. The material does not show a way to undo this after confirming.
