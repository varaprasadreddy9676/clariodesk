# ClarioDesk Frontend Documentation

This folder defines the frontend product, UX, design system, and component strategy
for the full ClarioDesk roadmap.

Related platform module docs:

- [Official WhatsApp Management](../official-whatsapp/official-whatsapp-management.md)

Read in order:

1. [Frontend Product Principles](./00-frontend-product-principles.md)
2. [Information Architecture](./01-information-architecture.md)
3. [Design System](./02-design-system.md)
4. [Layouts And Navigation](./03-layouts-and-navigation.md)
5. [Inbox Experience](./04-inbox-experience.md)
6. [Composer And Safety](./05-composer-and-safety.md)
7. [Message Rendering](./06-message-rendering.md)
8. [Ticket And Context Panel](./07-ticket-context-panel.md)
9. [Phone And Gateway UX](./08-phone-and-gateway-ux.md)
10. [Admin And Settings UX](./09-admin-settings-ux.md)
11. [States: Loading, Empty, Error, Offline](./10-states-loading-empty-error.md)
12. [Accessibility And Keyboard](./11-accessibility-and-keyboard.md)
13. [Responsive And Mobile](./12-responsive-mobile.md)
14. [Component Architecture](./13-component-architecture.md)
15. [Frontend Roadmap P1-P4](./14-roadmap-p1-p4-frontend.md)
16. [Feature UX Matrix](./15-feature-ux-matrix.md)
17. [AI-Native UX](./16-ai-native-ux.md)
18. [Notifications And PWA UX](./17-notifications-and-pwa.md)

## Product North Star

```text
No customer issue should be lost inside a WhatsApp group again.
```

ClarioDesk should be as easy to read and reply in as WhatsApp, while adding the
support operations controls that WhatsApp lacks: shared inboxes, internal notes,
tickets, owners, statuses, permissions, audit, media governance, diagnostics,
notifications, automation, AI, and compliance.
AI should be planned as a native assistive layer, but the core app must remain fully
usable when AI is disabled or no provider key is configured.
Web Push and PWA notification UX should be planned as a first-class bridge until
native mobile apps ship.

## Quality Bar

The UI must be:

- enterprise-grade
- modern
- dense but calm
- accessible
- fast
- permission-aware
- explicit about risk
- visually consistent
- free from generic AI-dashboard aesthetics

No frontend implementation should begin until the relevant docs here are reflected
in component, route, and state plans.
