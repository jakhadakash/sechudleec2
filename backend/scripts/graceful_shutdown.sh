#!/bin/bash
# Flush Sidekiq queues and stop the worker before EC2 stop.
set -e

LOG="/var/log/gitlab-shutdown.log"
echo "[$(date -u)] Starting graceful shutdown..." | tee -a "$LOG"

# Drain Sidekiq — wait up to 60s for active jobs to finish
gitlab-rails runner "
  require 'sidekiq/api'
  timeout = 60
  start = Time.now
  loop do
    stats = Sidekiq::Stats.new
    break if stats.workers_size == 0 || (Time.now - start) > timeout
    puts \"Waiting for #{stats.workers_size} Sidekiq workers...\"
    sleep 5
  end
  Sidekiq::Queue.all.each { |q| puts \"Queue #{q.name}: #{q.size} jobs\" }
  puts 'Sidekiq drain complete.'
" 2>&1 | tee -a "$LOG"

gitlab-ctl stop sidekiq 2>&1 | tee -a "$LOG"
echo "[$(date -u)] Sidekiq stopped. Safe to stop EC2." | tee -a "$LOG"
