# Monitoring and Alerts Runbook

## Document Information
- **Author**: Eric Haywood, HeadySystems Inc.
- **Version**: 4.0.0
- **Last Updated**: 2026-03-01

## Purpose
This runbook documents the monitoring infrastructure, alert configuration, and response procedures for all Heady platform alerts. All thresholds are derived from phi-math principles.

## Monitoring Architecture

The Heady monitoring stack consists of:

- **Prometheus** (port 9090): Metrics collection with fib(7) = 13 second scrape interval
- **Grafana** (port 3000): Visualization and dashboarding
- **Alertmanager** (port 9093): Alert routing, grouping, and notification
- **Node Exporter** (port 9100): Host-level metrics
- **HeadyHealth** (port 3328): Service-level health aggregation
- **HeadyTelemetry** (port 3356): Custom application metrics

All services expose Prometheus-compatible `/metrics` endpoints with standardized metric names prefixed with `heady_`.

## Alert Categories

### Service Health Alerts

**HeadyServiceDown** (Critical)
- **Trigger**: `up{job="heady-services"} == 0` for 5 minutes
- **Meaning**: A Heady service is completely unreachable
- **Response**: Follow Service Recovery Runbook, Step 1-5
- **Escalation**: P1 if Hot pool service, P2 if Warm or Cold pool service

**HeadyHighErrorRate** (Critical)
- **Trigger**: Error rate exceeds psi (38.2%) for 3 minutes
- **Meaning**: More than one-third of requests are failing
- **Response**: Check logs for error patterns, verify upstream dependencies, check for recent deployments. If a deployment preceded the error spike, initiate rollback per Deployment Runbook.
- **Escalation**: P1 immediately

**HeadyHighLatency** (Warning)
- **Trigger**: p99 latency exceeds phi-cubed seconds (4.236s) for 5 minutes
- **Meaning**: Tail latency has degraded significantly
- **Response**: Check service resource utilization (CPU, memory), database query performance, upstream dependency latency. Consider scaling up instance count if resource utilization exceeds the psi threshold (61.8%).

### Resource Alerts

**HeadyHighMemory** (Warning)
- **Trigger**: Memory utilization exceeds psi (61.8%) for 8 minutes
- **Meaning**: Memory consumption is elevated
- **Response**: Monitor for continued growth. Check for memory leaks by comparing resident memory against baseline. If growing, identify the leaking service and restart.

**HeadyCriticalMemory** (Critical)
- **Trigger**: Memory utilization exceeds 1 - psi-cubed (85.4%) for 3 minutes
- **Meaning**: Memory is near exhaustion, OOM kill risk
- **Response**: Immediately identify top memory consumers. Restart the highest-consumption service if it exceeds its expected allocation. Scale resources if the workload legitimately requires more memory.

**HeadyDiskWarning** (Warning)
- **Trigger**: Disk utilization exceeds psi (61.8%) for 13 minutes
- **Meaning**: Disk space is being consumed
- **Response**: Check log rotation, temporary file cleanup, and database vacuum status. Run HeadyMaid cleanup routines. If Prometheus TSDB is growing, verify retention settings (89 days, 13GB).

### Coherence Alerts

**HeadyCoherenceDrift** (Warning)
- **Trigger**: System coherence score drops below phiThreshold(2) = 0.809 for 5 minutes
- **Meaning**: AI node state vectors are diverging from expected alignment
- **Response**: Check which nodes are contributing to low coherence. Review recent configuration changes or model updates that could shift embedding geometry. If a specific node is the outlier, investigate its recent behavior and restart if necessary. Escalate to HeadySoul review if coherence continues to decline.

**HeadyCircuitBreakerOpen** (Critical)
- **Trigger**: Any circuit breaker enters OPEN state for more than 1 minute
- **Meaning**: A service has experienced fib(5) = 5 consecutive failures
- **Response**: Identify the failed service. Check its health endpoint directly (bypass the circuit breaker). If the service is healthy, the issue may be network-related — check DNS, routing, and firewall rules. If the service is unhealthy, follow Service Recovery Runbook.

## Alert Routing

Alertmanager routes alerts based on severity:

- **Critical alerts**: Immediate notification via webhook to HeadyNotification service (port 3347), grouped by alertname and service, with fib(6) = 8 second group wait and 1 hour repeat interval.
- **Warning alerts**: Standard notification with fib(8) = 21 second group wait, fib(9) = 34 second group interval, and 4 hour repeat interval.

## Dashboard Reference

The Heady Platform Overview dashboard (uid: heady-overview-v4) provides:

1. **Service Health Overview**: Stat panel showing count of healthy services
2. **Total Request Rate**: Time series of aggregate request throughput
3. **P99 Latency by Service**: Time series of tail latency per service
4. **Error Rate by Service**: Time series of error rates per service
5. **Coherence Score**: Gauge showing average system coherence
6. **Circuit Breaker States**: Table showing current state of all circuit breakers

## On-Call Procedures

On-call engineers should:

1. Acknowledge alerts within 5 minutes for P1, 13 minutes for P2
2. Follow the appropriate runbook for the alert type
3. Document all actions taken in the incident channel
4. Update the status page for user-facing incidents
5. Complete post-mortem for P1 and P2 incidents within 24 hours
