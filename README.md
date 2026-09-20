# Dashboard Notifications Card

Install this repository through HACS as a **Dashboard** repository, then add the generated JavaScript file as a Lovelace resource if HACS does not do so automatically.

The companion **Dashboard Notifications** integration must be installed and configured first.

```yaml
type: custom:dashboard-notifications-card
title: Laundry
topics:
  - 4efb1c3a-0000-0000-0000-000000000000
order: newest
hide_when_empty: true
show_timestamp: true
```

`topics` is required and accepts one or more registered topic IDs. Use the visual editor to select topic names rather than manually entering IDs.

Set `hide_when_empty: true` to remove the card and its vertical space whenever no matching notification is active.
Set `show_timestamp: false` to hide each notification's creation timestamp.

## Notification actions

Notifications created with an `actions` list display icon buttons on the card. The list supports one or more actions, with one button shown for each. An action can call any Home Assistant service, with optional service `data` and `target`. Set its `dismiss` option to `true` to remove the notification after that service succeeds; if it fails, the notification stays visible and the card shows an error. Configure actions in the companion integration's notification create service.
