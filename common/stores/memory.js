

class MemoryTaskStore {
  constructor() {
    this.tasks = {};
  }

  async get(taskId) {
    return this.tasks[taskId];
  }

  add(task) {
    this.tasks[task.id] = task;
  }

  update(task) {
    this.tasks[task.id] = task;
  }
}

module.exports = MemoryTaskStore;
