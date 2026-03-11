# Load and fault testing

## Load ideas
- replay auth-session introspection traffic
- send analytics bursts and search queries in the same window
- push notification fan-out and scheduler due-work checks together

## Fault ideas
- remove AutoContext upstream temporarily and verify graceful degradation
- block Consul registration and verify local start still succeeds
- inject stale session IDs and verify revoke/introspect behavior
