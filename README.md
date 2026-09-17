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
