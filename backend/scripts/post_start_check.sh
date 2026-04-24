#!/bin/bash
# Verify Puma, Redis, and PostgreSQL are ready after EC2 start.
set -e

LOG="/var/log/gitlab-startup.log"
MAX_WAIT=120
INTERVAL=10
elapsed=0

echo "[$(date -u)] Post-start health check begun..." | tee -a "$LOG"

wait_for() {
    local name=$1
    local check=$2
    elapsed=0
    while ! eval "$check" &>/dev/null; do
        echo "[$(date -u)] Waiting for $name... (${elapsed}s elapsed)" | tee -a "$LOG"
        sleep $INTERVAL
        elapsed=$((elapsed + INTERVAL))
        if [ $elapsed -ge $MAX_WAIT ]; then
            echo "[$(date -u)] FAILED: $name did not start within ${MAX_WAIT}s" | tee -a "$LOG"
            exit 1
        fi
    done
    echo "[$(date -u)] OK: $name is ready." | tee -a "$LOG"
}

wait_for "Puma"       "gitlab-ctl status puma       | grep -q 'run:'"
wait_for "Redis"      "gitlab-ctl status redis      | grep -q 'run:'"
wait_for "PostgreSQL" "gitlab-ctl status postgresql | grep -q 'run:'"

# Run reconfigure to prevent config drift on each startup
echo "[$(date -u)] Running gitlab-ctl reconfigure..." | tee -a "$LOG"
gitlab-ctl reconfigure >> "$LOG" 2>&1

echo "[$(date -u)] All services healthy. GitLab is ready." | tee -a "$LOG"
