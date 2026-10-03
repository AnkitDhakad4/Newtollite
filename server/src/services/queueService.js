const { EventEmitter } = require('events');

class ResilientQueue extends EventEmitter {
  constructor(intervalMs = 500) {
    super();
    this.intervalMs = intervalMs;
    this.jobs = new Map();
    this.isProcessing = false;
    this.timer = null;
    this.deadLetterQueue = [];
    this.start();
  }

  enqueue(name, data, maxAttempts = 3) {
    const id = `job_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    const job = {
      id,
      name,
      data,
      attempts: 0,
      maxAttempts,
      status: 'PENDING',
      nextAttemptAt: Date.now()
    };

    this.jobs.set(id, job);
    this.emit('enqueued', job);
    return id;
  }

  start() {
    if (this.timer) return;
    this.timer = setInterval(() => this.processNext(), this.intervalMs);
    if (this.timer.unref) {
      this.timer.unref();
    }
  }

  stop() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  async processNext() {
    if (this.isProcessing) return;

    const now = Date.now();
    const candidate = Array.from(this.jobs.values()).find(
      j => (j.status === 'PENDING' || j.status === 'FAILED') && 
           j.attempts < j.maxAttempts && 
           j.nextAttemptAt <= now
    );

    if (!candidate) return;

    this.isProcessing = true;
    candidate.status = 'RUNNING';
    candidate.attempts++;
    candidate.lastAttemptAt = new Date();

    try {
      this.emit('process', candidate);
    } catch (err) {
      this.markFailed(candidate.id, err.message);
    } finally {
      this.isProcessing = false;
    }
  }

  markCompleted(jobId) {
    const job = this.jobs.get(jobId);
    if (job) {
      job.status = 'COMPLETED';
      this.jobs.delete(jobId);
      this.emit('completed', job);
    }
  }

  markFailed(jobId, error) {
    const job = this.jobs.get(jobId);
    if (!job) return;

    job.error = error;
    if (job.attempts >= job.maxAttempts) {
      job.status = 'FAILED';
      this.jobs.delete(jobId);
      this.deadLetterQueue.push(job);
      console.error(`[ResilientQueue] Job ${job.id} (${job.name}) moved to Dead Letter Queue after ${job.attempts} attempts: ${error}`);
      this.emit('deadLetter', job);
    } else {
      job.status = 'FAILED';
      const delay = Math.pow(2, job.attempts) * 1000;
      job.nextAttemptAt = Date.now() + delay;
      console.warn(`[ResilientQueue] Job ${job.id} (${job.name}) failed (attempt ${job.attempts}/${job.maxAttempts}). Retrying in ${delay}ms...`);
    }
  }

  getDeadLetters() {
    return [...this.deadLetterQueue];
  }
}

const asyncTaskQueue = new ResilientQueue();

module.exports = {
  ResilientQueue,
  asyncTaskQueue
};
