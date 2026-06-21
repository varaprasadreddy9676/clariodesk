# Accessibility And Keyboard

ClarioDesk should meet WCAG 2.1 AA. Accessibility is especially important because
agents will use the product all day under time pressure.

## Keyboard Navigation

Required keyboard paths:

- Navigate app sidebar.
- Navigate channel list.
- Open selected channel.
- Move through timeline messages.
- Open message actions.
- Compose external reply.
- Compose internal note.
- Cancel send delay.
- Create ticket.
- Search.
- Open/close context panel.

Recommended shortcuts:

```text
Cmd/Ctrl+K: command menu
/: focus search
R: reply to selected message
N: internal note
T: create ticket from selected message
Esc: close menu/drawer or clear reply preview
Shift+Enter: newline in composer
Enter: send only when enabled/discoverable
```

Shortcuts must not be required for core workflows.

## Focus Management

- Modals and drawers trap focus.
- Closing a modal returns focus to the triggering element.
- New messages should not steal focus.
- Send-delay cancel must be reachable immediately by keyboard.
- Error banners should be announced where appropriate.

## Screen Reader Requirements

Provide meaningful labels:

```text
Channel Acme Support, 3 unread, 2 open tickets.
Incoming message from Meera at 10:42 AM.
Internal note by Priya, not sent to WhatsApp.
Message waiting send delay, 2 seconds remaining.
```

Avoid reading decorative icons.

## Color And Contrast

- Normal text: 4.5:1 contrast.
- Large text/icons: 3:1 minimum.
- Focus ring visible on all backgrounds.
- Risk states use icon + text, not only red/yellow.

## Forms

All inputs need:

- Visible label or accessible label.
- Validation message.
- Error association.
- Helpful placeholder only as secondary hint.

Do not use placeholder as the only label.

## Timeline Accessibility

The timeline should support:

- List semantics.
- Message row labels.
- Action menus.
- Jump to quoted message.
- Date markers.
- Live region for new message arrival where appropriate.

Do not auto-scroll if the user is reading older history unless they choose to jump
to latest.

## Reduced Motion

Respect reduced motion:

- Disable non-essential transitions.
- Avoid animated counters where not necessary.
- Keep state changes clear without motion.
